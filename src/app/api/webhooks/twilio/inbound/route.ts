/**
 * **POST /api/webhooks/twilio/inbound** — Twilio Messaging inbound SMS webhook.
 *
 * - Validates `X-Twilio-Signature` using `TWILIO_AUTH_TOKEN`.
 * - Normalizes `MessageSid`, `From`, `To`, `Body`, etc. into the shared inbox shape and calls **`applyInboundMessage`**
 *   (via {@link processTwilioInboundSms}); no CRM/thread logic in this file.
 * - **Idempotent:** duplicate `MessageSid` replays return **200** with empty TwiML (Twilio stops retrying).
 * - **Success response:** `200` + `Content-Type: text/xml` empty `<Response/>` (valid TwiML per Twilio SMS webhooks).
 *
 * Configure this URL in Twilio Console → Phone number / Messaging Service → **A message comes in** (HTTP POST).
 */
export { POST, runtime, maxDuration } from "@/server/integrations/twilio/inbound-sms-webhook";
