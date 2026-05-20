import "server-only";

import { createTwilioClient } from "@/integrations/twilio/client";
import { getTwilioServerEnv } from "@/lib/env/twilio-server";
import { err, ok, type Result } from "@/server/result";

export type SendTwilioOutboundSmsInput = {
  to: string;
  body: string;
  /** E.164 dealership line; falls back to env default when omitted. */
  from?: string;
};

/**
 * Sends a single SMS via Twilio REST API (server-only).
 * Used by `twilioOutboundSmsTransport` and `sendStaffSmsForConversation`. Inbox must use
 * `sendStaffReply` (server-only) — never call Twilio from client code.
 */
export async function sendTwilioOutboundSms(
  input: SendTwilioOutboundSmsInput
): Promise<Result<{ sid: string; from: string }>> {
  const to = input.to?.trim();
  const body = input.body?.trim();
  if (!to || !body) {
    return err("VALIDATION", "Twilio outbound SMS requires to and body.");
  }

  try {
    const client = createTwilioClient();
    const { sid } = await client.sendSms({
      to,
      body,
      ...(input.from?.trim() ? { from: input.from.trim() } : {}),
    });
    const twilioEnv = getTwilioServerEnv();
    const fromUsed = input.from?.trim() || twilioEnv.TWILIO_PHONE_NUMBER;
    return ok({ sid, from: fromUsed });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Twilio send failed";
    return err("TWILIO_ERROR", message);
  }
}
