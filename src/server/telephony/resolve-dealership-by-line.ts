import "server-only";

import { createSupabaseAdminClient } from "@/integrations/supabase/admin";
import type { StaffDepartment } from "@/integrations/supabase/database.types";
import { getTwilioServerEnv } from "@/lib/env/twilio-server";
import { normalizeE164 } from "@/lib/phone/e164";
import { findTwilioInboundRouteByLine } from "@/server/data/dealership-channel-accounts";
import { findDealershipByTwilioPhoneE164 } from "@/server/data/dealerships";
import { err, ok, type Result } from "@/server/result";

const e164Strict = /^\+[1-9]\d{6,14}$/;

export type TwilioInboundRoutingResolution = {
  dealershipId: string;
  /**
   * `dealership_channel_accounts.id` when a direct Twilio line mapping was found.
   * Null for legacy dealership fallbacks.
   */
  channelAccountId: string | null;
  /**
   * Optional inbound department route from channel account metadata.
   * Null keeps existing/default conversation routing behavior.
   */
  routeDepartment: StaffDepartment | null;
};

/**
 * Resolves `dealership_id` from the Twilio `To` / dealership line (E.164).
 *
 * Order: active `dealership_channel_accounts` (`twilio_sms`), then legacy `dealerships.twilio_phone_e164`,
 * then single-tenant env fallback when `TWILIO_PHONE_NUMBER` matches exactly one dealership.
 */
export async function resolveDealershipIdFromDialedNumber(
  dialedRaw: string
): Promise<Result<string>> {
  const routed = await resolveTwilioInboundRoutingByDialedNumber(dialedRaw);
  if (!routed.ok) {
    return routed;
  }
  return ok(routed.data.dealershipId);
}

/**
 * Resolves inbound Twilio route context from dialed number.
 *
 * Current shared-line mode:
 * - one active `twilio_sms` channel account maps all inbound to one dealership.
 *
 * Future multi-number mode:
 * - multiple active `twilio_sms` rows can map separate numbers (e.g. sales/service)
 * - optional channel-account metadata can steer inbound department for new threads.
 */
export async function resolveTwilioInboundRoutingByDialedNumber(
  dialedRaw: string
): Promise<Result<TwilioInboundRoutingResolution>> {
  const dialedTrimmed = dialedRaw.trim();
  if (!dialedTrimmed) {
    return err("VALIDATION", "Twilio inbound payload is missing a dialed To number.");
  }
  if (/[a-z]/i.test(dialedTrimmed)) {
    return err("VALIDATION", "Twilio inbound To number contains invalid characters.");
  }
  const supabase = createSupabaseAdminClient();
  const to = normalizeE164(dialedRaw);
  if (!e164Strict.test(to)) {
    return err("VALIDATION", "Twilio inbound To number must be E.164.");
  }

  const byChannel = await findTwilioInboundRouteByLine(to, supabase);
  if (!byChannel.ok) {
    return byChannel;
  }
  if (byChannel.data) {
    return ok(byChannel.data);
  }

  const byPhone = await findDealershipByTwilioPhoneE164(to, supabase);
  if (!byPhone.ok) {
    return byPhone;
  }
  if (byPhone.data?.id) {
    return ok({
      dealershipId: byPhone.data.id,
      channelAccountId: null,
      routeDepartment: null,
    });
  }

  let envPhone: string;
  try {
    envPhone = getTwilioServerEnv().TWILIO_PHONE_NUMBER.trim();
  } catch {
    return err("CONFIG_ERROR", "Twilio environment is misconfigured (TWILIO_*).");
  }
  if (normalizeE164(envPhone) === to) {
    const all = await supabase.from("dealerships").select("id").limit(2);
    if (all.error) {
      return err("DB_ERROR", all.error.message);
    }
    const rows = all.data ?? [];
    if (rows.length === 1) {
      return ok({
        dealershipId: rows[0].id,
        channelAccountId: null,
        routeDepartment: null,
      });
    }
  }

  return err(
    "UNKNOWN_DEALERSHIP",
    "No dealership is configured for this phone line. Add a twilio_sms row to dealership_channel_accounts or set dealerships.twilio_phone_e164."
  );
}
