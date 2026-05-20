import { parseInboundSmsFields } from "@/integrations/twilio/inbound-form";
import { normalizeE164 } from "@/lib/phone/e164";
import { err, ok, type Result } from "@/server/result";

import type { NormalizedInboundSms } from "./types";

function parseTwilioDateSent(dateSent: string | undefined): string {
  if (!dateSent?.trim()) {
    return new Date().toISOString();
  }
  const ms = Date.parse(dateSent.trim());
  if (Number.isFinite(ms)) {
    return new Date(ms).toISOString();
  }
  return new Date().toISOString();
}

/**
 * Maps a Twilio inbound SMS webhook body to the shared inbound message shape.
 */
export function normalizeTwilioInboundSms(
  raw: Record<string, string>
): Result<NormalizedInboundSms> {
  const parsed = parseInboundSmsFields(raw);
  if (!parsed) {
    return err("VALIDATION", "Missing MessageSid, From, or To on Twilio inbound payload.");
  }

  const text = (parsed.Body ?? "").trim();
  const mediaCount = Number.parseInt(parsed.NumMedia ?? "0", 10);
  const hasMedia = Number.isFinite(mediaCount) && mediaCount > 0;
  if (!text && !hasMedia) {
    return err("VALIDATION", "Twilio inbound SMS has an empty body.");
  }

  let customerPhone: string;
  try {
    customerPhone = normalizeE164(parsed.From);
  } catch {
    return err("VALIDATION", "Invalid customer From number on Twilio inbound payload.");
  }

  const normalized: NormalizedInboundSms = {
    externalMessageId: parsed.MessageSid,
    channel: "sms",
    customerPhone,
    text: text || "[media message]",
    timestamp: parseTwilioDateSent(parsed.DateSent),
    rawPayload: { ...raw },
  };

  return ok(normalized);
}
