import type { Tables } from "@/integrations/supabase/database.types";
import { resolveDb } from "@/server/data/internal";
import { fromPostgrestError } from "@/server/data/postgrest-error";
import type { TypedSupabaseClient } from "@/server/db/server-client";
import { ok, type Result } from "@/server/result";

export type DealershipRow = Tables<"dealerships">;

/**
 * Looks up a dealership whose legacy `twilio_phone_e164` matches the inbound `To` address.
 * Prefer routing via `dealership_channel_accounts` (`findDealershipIdByTwilioSmsInboundLine`) first.
 */
export async function findDealershipByTwilioPhoneE164(
  phoneE164: string,
  db?: TypedSupabaseClient
): Promise<Result<DealershipRow | null>> {
  const supabase = await resolveDb(db);
  const res = await supabase
    .from("dealerships")
    .select("*")
    .eq("twilio_phone_e164", phoneE164)
    .maybeSingle();

  if (res.error) {
    return fromPostgrestError(res.error);
  }

  return ok(res.data);
}
