import "server-only";

import { readAiInsightsFromMetadata } from "@/lib/conversation/ai-insights-metadata";
import {
  aggregateProfileHintsFromTexts,
  extractProfileHintsFromText,
  isPlaceholderCustomerName,
  mergeExtractedCustomerProfile,
  type ExtractedProfileHints,
} from "@/lib/conversation/extract-profile-hints";
import { normalizeE164 } from "@/lib/phone/e164";
import type { TypedSupabaseClient } from "@/server/db/server-client";
import { getConversationRowById } from "@/server/data/conversations";
import { getCustomerById, updateCustomerProfile } from "@/server/data/customers";
import { getMessagesForConversation } from "@/server/data/messages";

/** Example E.164 from forms/docs — not a real customer line. */
const DEMO_PHONE_E164 = "+17055550100";

function isPlaceholderEmail(email: string | null | undefined): boolean {
  const e = email?.trim().toLowerCase() ?? "";
  return !e || e === "name@example.com";
}

function isPlaceholderPhone(phone: string | null | undefined): boolean {
  const p = phone?.trim() ?? "";
  return !p || p === DEMO_PHONE_E164;
}

function isGenericWebChatTitle(title: string | null | undefined): boolean {
  const t = title?.trim() ?? "";
  return !t || t === "Web chat" || t.startsWith("Web chat —");
}

function normalizeStoredPhone(phone: string | null | undefined): string | null {
  const raw = phone?.trim();
  if (!raw) return null;
  const normalized = normalizeE164(raw);
  return normalized.startsWith("+") ? normalized : raw;
}

function profileHintsFromAiInsights(metadata: unknown): ExtractedProfileHints {
  const ai = readAiInsightsFromMetadata(metadata);
  if (!ai) {
    return { name: null, email: null, phoneE164: null };
  }
  return {
    name: ai.customer_profile.name?.trim() ?? null,
    email: ai.customer_profile.email?.trim() ?? null,
    phoneE164: normalizeStoredPhone(ai.customer_profile.phone_e164),
  };
}

function mergeProfileSources(input: {
  customerBodies: string[];
  latestText?: string;
  conversationMetadata: unknown;
}): ExtractedProfileHints {
  const threadHints = aggregateProfileHintsFromTexts(input.customerBodies);
  const latestHints = input.latestText
    ? extractProfileHintsFromText(input.latestText)
    : { name: null, email: null, phoneE164: null };
  const aiHints = profileHintsFromAiInsights(input.conversationMetadata);

  return mergeExtractedCustomerProfile({
    fromModel: mergeExtractedCustomerProfile({
      fromModel: threadHints,
      fromHeuristics: latestHints,
    }),
    fromHeuristics: aiHints,
  });
}

async function persistMergedProfileHints(
  input: {
    dealershipId: string;
    conversationId: string;
    customerId: string;
    merged: ExtractedProfileHints;
    conversationTitle: string | null;
  },
  db: TypedSupabaseClient
): Promise<void> {
  const { dealershipId, conversationId, customerId, merged } = input;

  const cust = await getCustomerById(dealershipId, customerId, db);
  if (!cust.ok) {
    return;
  }

  const patch: {
    displayName?: string;
    email?: string;
    phoneE164?: string;
  } = {};

  if (
    merged.name?.trim() &&
    (isPlaceholderCustomerName(cust.data.display_name) ||
      !cust.data.display_name?.trim())
  ) {
    patch.displayName = merged.name.trim();
  }

  if (merged.email?.trim() && isPlaceholderEmail(cust.data.email)) {
    patch.email = merged.email.trim();
  }

  const mergedPhone = normalizeStoredPhone(merged.phoneE164);
  if (mergedPhone && isPlaceholderPhone(cust.data.phone_e164)) {
    patch.phoneE164 = mergedPhone;
  }

  if (Object.keys(patch).length > 0) {
    const updated = await updateCustomerProfile(
      {
        dealershipId,
        customerId,
        ...patch,
      },
      db
    );
    if (!updated.ok) {
      console.error(
        "[sync] updateCustomerProfile failed",
        conversationId,
        updated.error
      );
    }
  }

  const resolvedName =
    patch.displayName ??
    (!isPlaceholderCustomerName(cust.data.display_name)
      ? cust.data.display_name?.trim()
      : null) ??
    merged.name?.trim() ??
    null;

  if (resolvedName?.trim() && isGenericWebChatTitle(input.conversationTitle)) {
    await db
      .from("conversations")
      .update({
        title: `Web chat — ${resolvedName.trim()}`,
        updated_at: new Date().toISOString(),
      })
      .eq("id", conversationId)
      .eq("dealership_id", dealershipId);
  }
}

/**
 * Pull name / phone / email from customer messages and persist on the CRM row.
 * Runs on every inbound web (and other) customer message so Inbox stays in sync
 * without waiting for an AI reply.
 */
export async function syncCustomerProfileFromInboundMessage(
  input: {
    dealershipId: string;
    conversationId: string;
    latestCustomerText: string;
  },
  db: TypedSupabaseClient
): Promise<void> {
  const dealershipId = input.dealershipId.trim();
  const conversationId = input.conversationId.trim();
  const latestText = input.latestCustomerText.trim();
  if (!dealershipId || !conversationId || !latestText) {
    return;
  }

  const conv = await getConversationRowById(dealershipId, conversationId, db);
  if (!conv.ok || !conv.data.customer_id) {
    return;
  }

  const msgs = await getMessagesForConversation(dealershipId, conversationId, {
    limit: 50,
    db,
  });
  const customerBodies = msgs.ok
    ? msgs.data
        .filter((m) => m.sender_type === "customer")
        .map((m) => (m.body ?? "").trim())
        .filter(Boolean)
    : [];
  if (!customerBodies.includes(latestText)) {
    customerBodies.push(latestText);
  }

  const merged = mergeProfileSources({
    customerBodies,
    latestText,
    conversationMetadata: conv.data.metadata,
  });

  await persistMergedProfileHints(
    {
      dealershipId,
      conversationId,
      customerId: conv.data.customer_id,
      merged,
      conversationTitle: conv.data.title,
    },
    db
  );
}

/**
 * Re-sync CRM profile when staff opens a thread (chat + AI insights → customers row).
 */
export async function syncCustomerProfileFromConversationThread(
  dealershipId: string,
  conversationId: string,
  db: TypedSupabaseClient
): Promise<void> {
  const d = dealershipId.trim();
  const c = conversationId.trim();
  if (!d || !c) {
    return;
  }

  const conv = await getConversationRowById(d, c, db);
  if (!conv.ok || !conv.data.customer_id) {
    return;
  }

  const msgs = await getMessagesForConversation(d, c, { limit: 200, db });
  const customerBodies = msgs.ok
    ? msgs.data
        .filter((m) => m.sender_type === "customer")
        .map((m) => (m.body ?? "").trim())
        .filter(Boolean)
    : [];

  const merged = mergeProfileSources({
    customerBodies,
    conversationMetadata: conv.data.metadata,
  });

  await persistMergedProfileHints(
    {
      dealershipId: d,
      conversationId: c,
      customerId: conv.data.customer_id,
      merged,
      conversationTitle: conv.data.title,
    },
    db
  );
}
