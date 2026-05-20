/**
 * Twilio Messaging webhooks: `application/x-www-form-urlencoded` decoded to a flat string map.
 * Signature validation lives in `src/server/integrations/twilio/validate-request.ts` (needs `Request`).
 */

/** True if `raw` is a non-array object suitable as a Twilio form field map. */
export function isTwilioFormFieldMap(raw: unknown): raw is Record<string, string> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return false;
  }
  return Object.values(raw).every((v) => typeof v === "string");
}

/**
 * Minimal inbound SMS shape checks before domain normalization.
 * Returns a human-readable error message, or `null` if OK.
 */
export function twilioSmsInboundFieldError(raw: Record<string, string>): string | null {
  const sid = raw.MessageSid?.trim();
  if (!sid) {
    return "Missing MessageSid.";
  }
  if (!/^SM[a-fA-F0-9]{32}$/.test(sid)) {
    return "Invalid MessageSid format.";
  }
  if (!raw.From?.trim()) {
    return "Missing From.";
  }
  if (!raw.To?.trim()) {
    return "Missing To.";
  }
  const body = raw.Body ?? "";
  if (body.length > 16_000) {
    return "Inbound Body exceeds 16000 characters.";
  }
  return null;
}
