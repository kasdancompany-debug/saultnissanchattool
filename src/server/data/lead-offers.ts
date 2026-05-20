import "server-only";

import type { StaffDepartment } from "@/integrations/supabase/database.types";
import { createSupabaseAdminClient } from "@/integrations/supabase/admin";
import type {
  DealershipLeadOfferAnalytics,
  LeadOfferEventType,
  LeadOfferRow,
} from "@/lib/lead-offers/types";
import { resolveDb } from "@/server/data/internal";
import { fromPostgrestError } from "@/server/data/postgrest-error";
import type { TypedSupabaseClient } from "@/server/db/server-client";
import { ok, type Result } from "@/server/result";

export type LeadOfferUpsertInput = {
  name: string;
  description: string;
  is_active: boolean;
  department: StaffDepartment;
  priority: number;
  starts_at: string | null;
  ends_at: string | null;
  cta_text: string;
};

function isOfferInSchedule(
  row: Pick<LeadOfferRow, "starts_at" | "ends_at">,
  at: Date
): boolean {
  const t = at.getTime();
  if (row.starts_at) {
    const s = new Date(row.starts_at).getTime();
    if (t < s) return false;
  }
  if (row.ends_at) {
    const e = new Date(row.ends_at).getTime();
    if (t > e) return false;
  }
  return true;
}

function departmentMatches(
  offerDept: StaffDepartment,
  conversationDept: StaffDepartment
): boolean {
  if (offerDept === "general") return true;
  if (conversationDept === "general") return true;
  return offerDept === conversationDept;
}

export async function listLeadOffersForDealership(
  dealershipId: string,
  db?: TypedSupabaseClient
): Promise<Result<LeadOfferRow[]>> {
  const supabase = await resolveDb(db);
  const res = await supabase
    .from("lead_offers")
    .select("*")
    .eq("dealership_id", dealershipId)
    .order("priority", { ascending: false })
    .order("created_at", { ascending: false });

  if (res.error) return fromPostgrestError(res.error);
  return ok((res.data ?? []) as LeadOfferRow[]);
}

export async function listActiveLeadOffersForContext(
  dealershipId: string,
  conversationDepartment: StaffDepartment,
  at: Date = new Date(),
  db?: TypedSupabaseClient
): Promise<Result<LeadOfferRow[]>> {
  const all = await listLeadOffersForDealership(dealershipId, db);
  if (!all.ok) return all;

  const active = all.data.filter(
    (o) =>
      o.is_active &&
      isOfferInSchedule(o, at) &&
      departmentMatches(o.department, conversationDepartment)
  );
  return ok(active);
}

export async function upsertLeadOffer(
  dealershipId: string,
  input: LeadOfferUpsertInput,
  offerId?: string | null,
  db?: TypedSupabaseClient
): Promise<Result<LeadOfferRow>> {
  const supabase = await resolveDb(db);
  const now = new Date().toISOString();
  const row = {
    dealership_id: dealershipId,
    name: input.name,
    description: input.description,
    is_active: input.is_active,
    department: input.department,
    priority: input.priority,
    starts_at: input.starts_at,
    ends_at: input.ends_at,
    cta_text: input.cta_text,
    updated_at: now,
  };

  if (offerId) {
    const res = await supabase
      .from("lead_offers")
      .update(row)
      .eq("dealership_id", dealershipId)
      .eq("id", offerId)
      .select("*")
      .single();
    if (res.error) return fromPostgrestError(res.error);
    return ok(res.data as LeadOfferRow);
  }

  const res = await supabase.from("lead_offers").insert(row).select("*").single();
  if (res.error) return fromPostgrestError(res.error);
  return ok(res.data as LeadOfferRow);
}

export async function deleteLeadOffer(
  dealershipId: string,
  offerId: string,
  db?: TypedSupabaseClient
): Promise<Result<void>> {
  const supabase = await resolveDb(db);
  const res = await supabase
    .from("lead_offers")
    .delete()
    .eq("dealership_id", dealershipId)
    .eq("id", offerId);
  if (res.error) return fromPostgrestError(res.error);
  return ok(undefined);
}

/** Service-role insert for AI pipeline (deduped by unique index when conversation_id set). */
export async function recordLeadOfferEvent(input: {
  dealershipId: string;
  offerId: string;
  conversationId: string | null;
  eventType: LeadOfferEventType;
}): Promise<void> {
  try {
    const supabase = createSupabaseAdminClient();
    const { error } = await supabase.from("lead_offer_events").insert({
      dealership_id: input.dealershipId,
      offer_id: input.offerId,
      conversation_id: input.conversationId,
      event_type: input.eventType,
    });
    if (error && error.code !== "23505") {
      console.error("[lead_offers] recordLeadOfferEvent:", error.message);
    }
  } catch (e) {
    console.error("[lead_offers] recordLeadOfferEvent:", e);
  }
}

export async function loadLeadOfferAnalytics(
  dealershipId: string,
  sinceIso: string,
  db?: TypedSupabaseClient
): Promise<Result<DealershipLeadOfferAnalytics>> {
  const supabase = await resolveDb(db);

  const [offersRes, eventsRes] = await Promise.all([
    supabase
      .from("lead_offers")
      .select("id, name")
      .eq("dealership_id", dealershipId),
    supabase
      .from("lead_offer_events")
      .select("offer_id, event_type")
      .eq("dealership_id", dealershipId)
      .gte("created_at", sinceIso),
  ]);

  if (offersRes.error) return fromPostgrestError(offersRes.error);
  if (eventsRes.error) return fromPostgrestError(eventsRes.error);

  const nameById = new Map(
    (offersRes.data ?? []).map((o) => [o.id, o.name] as const)
  );

  const counts = new Map<
    string,
    { views: number; starts: number; completes: number; leads: number }
  >();

  for (const ev of eventsRes.data ?? []) {
    const cur = counts.get(ev.offer_id) ?? {
      views: 0,
      starts: 0,
      completes: 0,
      leads: 0,
    };
    if (ev.event_type === "view") cur.views += 1;
    else if (ev.event_type === "start") cur.starts += 1;
    else if (ev.event_type === "complete") cur.completes += 1;
    else if (ev.event_type === "lead") cur.leads += 1;
    counts.set(ev.offer_id, cur);
  }

  const byOffer = [...counts.entries()].map(([offerId, c]) => ({
    offerId,
    offerName: nameById.get(offerId) ?? "Offer",
    views: c.views,
    starts: c.starts,
    completes: c.completes,
    leads: c.leads,
    completionRate: c.starts > 0 ? Math.round((c.completes / c.starts) * 1000) / 10 : null,
  }));

  byOffer.sort((a, b) => b.views - a.views);

  const totals = byOffer.reduce(
    (acc, o) => ({
      views: acc.views + o.views,
      starts: acc.starts + o.starts,
      completes: acc.completes + o.completes,
      leads: acc.leads + o.leads,
    }),
    { views: 0, starts: 0, completes: 0, leads: 0 }
  );

  return ok({
    totals: {
      ...totals,
      completionRate:
        totals.starts > 0
          ? Math.round((totals.completes / totals.starts) * 1000) / 10
          : null,
    },
    byOffer,
  });
}
