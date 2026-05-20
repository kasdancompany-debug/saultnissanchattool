import "server-only";

import {
  isTwilioFormFieldMap,
  twilioSmsInboundFieldError,
} from "@/integrations/twilio/webhook-payload";
import type { TypedSupabaseClient } from "@/server/db/server-client";
import { normalizeTwilioInboundSms } from "@/server/integrations/twilio/normalize-inbound-sms";
import type { NormalizedInboundSms } from "@/server/integrations/twilio/types";
import { applyInboundMessage } from "@/server/messaging/inbound/apply-inbound-message";
import type {
  InboundNormalizedCore,
  NormalizedInboundMessage,
} from "@/server/messaging/inbound/normalized-inbound-message";
import { resolveTwilioInboundRoutingByDialedNumber } from "@/server/telephony/resolve-dealership-by-line";
import { err, ok, type Result } from "@/server/result";

import type { InboundApplyResult, InboundChannelAdapter } from "../channel-adapter";
import { parseValidateNormalize } from "../channel-adapter";

function toInboundNormalizedCore(n: NormalizedInboundSms): InboundNormalizedCore {
  return {
    externalMessageId: n.externalMessageId,
    channel: "sms",
    channelAccountId: n.rawPayload.To?.trim(), // overwritten by route mapping when available
    customerPhone: n.customerPhone,
    text: n.text,
    timestamp: n.timestamp,
    twilioInboundSid: n.externalMessageId,
    /** Full Twilio form post (same object as {@link NormalizedInboundSms.rawPayload}). */
    rawPayload: n.rawPayload,
  };
}

export const twilioSmsInboundAdapter: InboundChannelAdapter<Record<string, string>> = {
  channelKey: "twilio_sms",

  parseWebhookPayload(raw: unknown): Result<Record<string, string>> {
    if (!isTwilioFormFieldMap(raw)) {
      return err("VALIDATION", "Twilio inbound payload must be a field map.");
    }
    return ok(raw);
  },

  validateProviderRequest(parsed: Record<string, string>): Result<void> {
    const fieldErr = twilioSmsInboundFieldError(parsed);
    if (fieldErr) {
      return err("VALIDATION", fieldErr);
    }
    return ok(undefined);
  },

  normalize(parsed: Record<string, string>): Result<InboundNormalizedCore> {
    const sms = normalizeTwilioInboundSms(parsed);
    if (!sms.ok) {
      return sms;
    }
    return ok(toInboundNormalizedCore(sms.data));
  },

  async ingest(raw: unknown, db: TypedSupabaseClient): Promise<Result<InboundApplyResult>> {
    const chain = parseValidateNormalize(twilioSmsInboundAdapter, raw);
    if (!chain.ok) {
      return chain;
    }
    const { parsed, core } = chain.data;

    const toRaw = parsed.To?.trim();
    if (!toRaw) {
      return err("VALIDATION", "Missing To on Twilio inbound payload.");
    }

    const routingRes = await resolveTwilioInboundRoutingByDialedNumber(toRaw);
    if (!routingRes.ok) {
      return routingRes;
    }
    const routing = routingRes.data;
    const dealershipId = routing.dealershipId;

    const normalized: NormalizedInboundMessage = {
      ...core,
      dealershipId,
      channelAccountId: routing.channelAccountId ?? core.channelAccountId,
      routeDepartment: routing.routeDepartment,
    };

    const applied = await applyInboundMessage(normalized, db);
    if (!applied.ok) {
      return applied;
    }

    if (applied.data.duplicate) {
      return ok({ kind: "duplicate" });
    }

    return ok({
      kind: "inserted",
      dealershipId,
      conversationId: applied.data.conversation.id,
      messageId: applied.data.message.id,
      createdAt: applied.data.message.created_at,
      isNewConversation: applied.data.createdNewConversation,
    });
  },
};
