import "server-only";

import { createSupabaseAdminClient } from "@/integrations/supabase/admin";
import { getTwilioSmsFromE164ForDealership } from "@/server/data/dealership-channel-accounts";
import { getConversationRowById } from "@/server/data/conversations";
import { resolveSmsRecipientForConversation } from "@/server/integrations/twilio/conversation-sms-outbound.service";
import { sendTwilioOutboundSms } from "@/server/integrations/twilio/send-outbound-sms";

import type {
  OutboundDispatchContext,
  OutboundDispatchResult,
  OutboundTransport,
} from "../transport/types";

/**
 * Twilio REST send for an **already-persisted** staff SMS row (`sendStaffReply` non-SMS path, retries, tests).
 * Primary inbox flow uses {@link import("@/server/integrations/twilio/conversation-sms-outbound.service").sendStaffSmsForConversation}
 * for SMS so Twilio is never invoked from the client.
 */
export const twilioOutboundSmsTransport: OutboundTransport = {
  id: "twilio_sms",
  async dispatch(ctx: OutboundDispatchContext): Promise<OutboundDispatchResult> {
    if (ctx.channel !== "sms") {
      return {
        ok: false,
        code: "CHANNEL",
        message: "Twilio SMS transport only supports the sms channel.",
      };
    }

    const supabase = createSupabaseAdminClient();

    const conv = await getConversationRowById(
      ctx.dealershipId,
      ctx.conversationId,
      supabase
    );
    if (!conv.ok) {
      return {
        ok: false,
        code: conv.error.code,
        message: conv.error.message,
      };
    }

    const toRes = await resolveSmsRecipientForConversation(
      ctx.dealershipId,
      ctx.conversationId,
      supabase
    );
    if (!toRes.ok) {
      return {
        ok: false,
        code: toRes.error.code,
        message: toRes.error.message,
      };
    }

    const fromAcct = await getTwilioSmsFromE164ForDealership(ctx.dealershipId, supabase);
    if (!fromAcct.ok) {
      return { ok: false, code: fromAcct.error.code, message: fromAcct.error.message };
    }

    let fromLine = fromAcct.data?.trim() || undefined;
    if (!fromLine) {
      const dealership = await supabase
        .from("dealerships")
        .select("twilio_phone_e164")
        .eq("id", ctx.dealershipId)
        .maybeSingle();

      if (dealership.error) {
        return { ok: false, code: "DB_ERROR", message: dealership.error.message };
      }
      fromLine = dealership.data?.twilio_phone_e164?.trim() || undefined;
    }

    const sent = await sendTwilioOutboundSms({
      to: toRes.data,
      body: ctx.body,
      ...(fromLine ? { from: fromLine } : {}),
    });
    if (!sent.ok) {
      return {
        ok: false,
        code: sent.error.code,
        message: sent.error.message,
      };
    }
    return {
      ok: true,
      providerMessageId: sent.data.sid,
      twilio: { to: toRes.data, from: sent.data.from },
    };
  },
};
