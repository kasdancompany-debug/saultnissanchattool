import "server-only";

import type { StaffDepartment } from "@/integrations/supabase/database.types";
import type { Tables } from "@/integrations/supabase/database.types";
import { resolveDb } from "@/server/data/internal";
import { fromPostgrestError } from "@/server/data/postgrest-error";
import type { TypedSupabaseClient } from "@/server/db/server-client";
import { ok, type Result } from "@/server/result";

export type DealershipChannelAccountRow = Tables<"dealership_channel_accounts">;

/** Settings / inbox UI: no `metadata` (may contain provider extras; never send raw JSON to the browser). */
export type DealershipChannelAccountSettingsRow = Pick<
  DealershipChannelAccountRow,
  "id" | "dealership_id" | "provider" | "external_account_id" | "display_label" | "is_active" | "created_at" | "updated_at"
>;

/**
 * Known `dealership_channel_accounts.provider` values (free-text column — add new keys in app + seed data).
 *
 * - **Inbound:** webhooks resolve `(provider, external_account_id)` → `dealership_id` (Twilio line E.164;
 *   Meta Page / IG account id via {@link findDealershipIdByMetaExternalAccount}).
 * - **Outbound:** pick an active row for `twilio_sms` as default `From`, or read Meta page id from `metadata` for Graph sends.
 */
export const DEALERSHIP_CHANNEL_PROVIDER = {
  TWILIO_SMS: "twilio_sms",
  META_MESSENGER: "meta_messenger",
  META_INSTAGRAM: "meta_instagram",
  META_WHATSAPP: "meta_whatsapp",
} as const;

export type DealershipChannelProvider =
  (typeof DEALERSHIP_CHANNEL_PROVIDER)[keyof typeof DEALERSHIP_CHANNEL_PROVIDER];

/**
 * Twilio SMS inbound `To` / outbound `From`: match active row by E.164 in `external_account_id`.
 */
/**
 * Lists channel account bindings for a dealership (RLS: staff with dealership access).
 * Omits `metadata` from the payload for safe client rendering.
 */
export async function listDealershipChannelAccountSettingsRows(
  dealershipId: string,
  db?: TypedSupabaseClient
): Promise<Result<DealershipChannelAccountSettingsRow[]>> {
  const supabase = await resolveDb(db);
  const res = await supabase
    .from("dealership_channel_accounts")
    .select(
      "id, dealership_id, provider, external_account_id, display_label, is_active, created_at, updated_at"
    )
    .eq("dealership_id", dealershipId.trim())
    .order("provider", { ascending: true })
    .order("created_at", { ascending: true });

  if (res.error) {
    return fromPostgrestError(res.error);
  }

  return ok((res.data ?? []) as DealershipChannelAccountSettingsRow[]);
}

export async function findDealershipIdByTwilioSmsInboundLine(
  inboundToE164: string,
  db?: TypedSupabaseClient
): Promise<Result<string | null>> {
  const supabase = await resolveDb(db);
  const res = await supabase
    .from("dealership_channel_accounts")
    .select("dealership_id")
    .eq("provider", DEALERSHIP_CHANNEL_PROVIDER.TWILIO_SMS)
    .eq("external_account_id", inboundToE164.trim())
    .eq("is_active", true)
    .maybeSingle();

  if (res.error) {
    return fromPostgrestError(res.error);
  }

  return ok(res.data?.dealership_id ?? null);
}

export type TwilioInboundRoute = {
  dealershipId: string;
  channelAccountId: string;
  routeDepartment: StaffDepartment | null;
};

function parseInboundDepartmentFromMetadata(metadata: unknown): StaffDepartment | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }
  const value =
    (metadata as Record<string, unknown>).inbound_department ??
    (metadata as Record<string, unknown>).default_department;
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  switch (normalized) {
    case "sales":
    case "service":
    case "parts":
    case "bdc":
    case "management":
    case "general":
      return normalized;
    default:
      return null;
  }
}

/**
 * Twilio inbound mapping row for the dialed line.
 *
 * This is the future-proof path for one shared line today and optional multi-line routing later:
 * - each active `twilio_sms` row represents an inbound/outbound account binding
 * - optional `metadata.inbound_department` (or `default_department`) steers new-thread department
 */
export async function findTwilioInboundRouteByLine(
  inboundToE164: string,
  db?: TypedSupabaseClient
): Promise<Result<TwilioInboundRoute | null>> {
  const supabase = await resolveDb(db);
  const res = await supabase
    .from("dealership_channel_accounts")
    .select("id, dealership_id, metadata")
    .eq("provider", DEALERSHIP_CHANNEL_PROVIDER.TWILIO_SMS)
    .eq("external_account_id", inboundToE164.trim())
    .eq("is_active", true)
    .maybeSingle();

  if (res.error) {
    return fromPostgrestError(res.error);
  }
  if (!res.data) {
    return ok(null);
  }

  return ok({
    dealershipId: res.data.dealership_id,
    channelAccountId: res.data.id,
    routeDepartment: parseInboundDepartmentFromMetadata(res.data.metadata),
  });
}

/**
 * Default Twilio `From` E.164 for a dealership: earliest active `twilio_sms` channel row, if any.
 */
export async function getTwilioSmsFromE164ForDealership(
  dealershipId: string,
  db?: TypedSupabaseClient
): Promise<Result<string | null>> {
  const supabase = await resolveDb(db);
  const res = await supabase
    .from("dealership_channel_accounts")
    .select("external_account_id")
    .eq("dealership_id", dealershipId.trim())
    .eq("provider", DEALERSHIP_CHANNEL_PROVIDER.TWILIO_SMS)
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (res.error) {
    return fromPostgrestError(res.error);
  }

  const line = res.data?.external_account_id?.trim();
  return ok(line || null);
}

/**
 * Inbound Meta webhooks: `recipient.id` (Page ID or Instagram professional account ID) must match
 * an active `dealership_channel_accounts` row for {@link DEALERSHIP_CHANNEL_PROVIDER.META_MESSENGER}
 * or {@link DEALERSHIP_CHANNEL_PROVIDER.META_INSTAGRAM}.
 */
export async function findDealershipIdByMetaExternalAccount(
  provider:
    | typeof DEALERSHIP_CHANNEL_PROVIDER.META_MESSENGER
    | typeof DEALERSHIP_CHANNEL_PROVIDER.META_INSTAGRAM,
  externalAccountId: string,
  db?: TypedSupabaseClient
): Promise<Result<string | null>> {
  const id = externalAccountId.trim();
  if (!id) {
    return ok(null);
  }

  const supabase = await resolveDb(db);
  const res = await supabase
    .from("dealership_channel_accounts")
    .select("dealership_id")
    .eq("provider", provider)
    .eq("external_account_id", id)
    .eq("is_active", true)
    .maybeSingle();

  if (res.error) {
    return fromPostgrestError(res.error);
  }

  return ok(res.data?.dealership_id ?? null);
}
