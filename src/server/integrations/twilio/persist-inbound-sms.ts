import "server-only";

import { createSupabaseAdminClient } from "@/integrations/supabase/admin";
import { twilioSmsInboundAdapter } from "@/server/inbox/adapters/twilio-sms.adapter";
import { ok, type Result } from "@/server/result";

export type TwilioInboundSmsOk =
  | { duplicate: true }
  | { duplicate: false; conversationId: string; messageId: string };

/**
 * Idempotent Twilio SMS inbound processor (call after signature verification).
 * Delegates to {@link twilioSmsInboundAdapter} → `applyInboundMessage` inbox pipeline.
 */
export async function processTwilioInboundSms(
  raw: Record<string, string>
): Promise<Result<TwilioInboundSmsOk>> {
  const db = createSupabaseAdminClient();
  const res = await twilioSmsInboundAdapter.ingest(raw, db);
  if (!res.ok) {
    return res;
  }
  if (res.data.kind === "duplicate") {
    return ok({ duplicate: true });
  }
  return ok({
    duplicate: false,
    conversationId: res.data.conversationId,
    messageId: res.data.messageId,
  });
}
