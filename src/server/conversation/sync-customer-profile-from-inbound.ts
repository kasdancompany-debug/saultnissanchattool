import "server-only";

import type { TypedSupabaseClient } from "@/server/db/server-client";
import {
  aggregateProfileHintsFromTexts,
  extractProfileHintsFromText,
  isPlaceholderCustomerName,
  mergeExtractedCustomerProfile,
} from "@/lib/conversation/extract-profile-hints";
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

  const customerId = conv.data.customer_id;

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

  const threadHints = aggregateProfileHintsFromTexts(customerBodies);
  const latestHints = extractProfileHintsFromText(latestText);
  const merged = mergeExtractedCustomerProfile({
    fromModel: threadHints,
    fromHeuristics: latestHints,
  });

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

  if (merged.phoneE164?.trim() && isPlaceholderPhone(cust.data.phone_e164)) {
    patch.phoneE164 = merged.phoneE164.trim();
  }

  if (Object.keys(patch).length > 0) {
    await updateCustomerProfile(
      {
        dealershipId,
        customerId,
        ...patch,
      },
      db
    );
  }

  const resolvedName =
    patch.displayName ??
    (!isPlaceholderCustomerName(cust.data.display_name)
      ? cust.data.display_name?.trim()
      : null) ??
    merged.name?.trim() ??
    null;

  if (resolvedName?.trim() && isGenericWebChatTitle(conv.data.title)) {
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
