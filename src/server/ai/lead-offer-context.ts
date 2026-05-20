import "server-only";

import type { StaffDepartment } from "@/integrations/supabase/database.types";
import type { LeadOfferRow } from "@/lib/lead-offers/types";
import {
  listActiveLeadOffersForContext,
  recordLeadOfferEvent,
} from "@/server/data/lead-offers";
import type { TypedSupabaseClient } from "@/server/db/server-client";

export type OfferForPrompt = {
  id: string;
  name: string;
  description: string;
  cta_text: string;
  department: StaffDepartment;
};

export async function loadOffersForAiContext(
  dealershipId: string,
  conversationDepartment: StaffDepartment,
  db?: TypedSupabaseClient
): Promise<OfferForPrompt[]> {
  const res = await listActiveLeadOffersForContext(
    dealershipId,
    conversationDepartment,
    new Date(),
    db
  );
  if (!res.ok || res.data.length === 0) return [];

  return res.data.slice(0, 5).map((o: LeadOfferRow) => ({
    id: o.id,
    name: o.name,
    description: o.description.trim(),
    cta_text: o.cta_text.trim(),
    department: o.department,
  }));
}

export function formatOffersForPrompt(offers: OfferForPrompt[]): string {
  if (offers.length === 0) return "";
  const lines = offers.map(
    (o, i) =>
      `${i + 1}. id=${o.id} | name="${o.name}" | dept=${o.department}${
        o.description ? ` | detail="${o.description}"` : ""
      }${o.cta_text ? ` | cta="${o.cta_text}"` : ""}`
  );
  return `Active dealership offers (mention at most ONE when genuinely helpful — never pushy):
${lines.join("\n")}

Offer voice rules:
- Sound helpful, not salesy. One brief mention max per reply.
- Example tone: "We also have an Instant Trade event running if you'd like a quick estimate."
- If you mention an offer, set offer_id to that offer's id in your JSON response. Otherwise offer_id must be null.`;
}

export async function pickOfferForReply(
  offers: OfferForPrompt[],
  recentlyOfferedIds: string[]
): Promise<OfferForPrompt | null> {
  if (offers.length === 0) return null;
  const fresh = offers.filter((o) => !recentlyOfferedIds.includes(o.id));
  const pool = fresh.length > 0 ? fresh : offers;
  return pool[0] ?? null;
}

export async function logOfferViewIfPresent(input: {
  dealershipId: string;
  conversationId: string;
  offerId: string | null | undefined;
}): Promise<void> {
  if (!input.offerId) return;
  await recordLeadOfferEvent({
    dealershipId: input.dealershipId,
    offerId: input.offerId,
    conversationId: input.conversationId,
    eventType: "view",
  });
}

export async function logOfferStartFromCustomerReply(input: {
  dealershipId: string;
  conversationId: string;
  lastAiOfferId: string | null | undefined;
}): Promise<void> {
  if (!input.lastAiOfferId) return;
  await recordLeadOfferEvent({
    dealershipId: input.dealershipId,
    offerId: input.lastAiOfferId,
    conversationId: input.conversationId,
    eventType: "start",
  });
}

export function readLastOfferedIdFromConversationMetadata(
  metadata: unknown
): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }
  const oid = (metadata as Record<string, unknown>).last_offered_lead_offer_id;
  return typeof oid === "string" && oid.length > 0 ? oid : null;
}

export async function logOfferCompleteIfAttributed(input: {
  dealershipId: string;
  conversationId: string;
  offerId: string | null | undefined;
}): Promise<void> {
  if (!input.offerId) return;
  await recordLeadOfferEvent({
    dealershipId: input.dealershipId,
    offerId: input.offerId,
    conversationId: input.conversationId,
    eventType: "complete",
  });
}

export async function logOfferLeadIfAttributed(input: {
  dealershipId: string;
  conversationId: string;
  offerId: string | null | undefined;
}): Promise<void> {
  if (!input.offerId) return;
  await recordLeadOfferEvent({
    dealershipId: input.dealershipId,
    offerId: input.offerId,
    conversationId: input.conversationId,
    eventType: "lead",
  });
}
