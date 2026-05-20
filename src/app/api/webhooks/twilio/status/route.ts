/**
 * **POST /api/webhooks/twilio/status** — Twilio Messaging **status callback** (delivery updates).
 *
 * - Validates `X-Twilio-Signature`.
 * - Updates `messages` where `twilio_outbound_sid` = Twilio `MessageSid` (`delivery_status` + `metadata.transport`).
 * - Appends a **`metadata_changed`** conversation event when `delivery_status` actually changes (retries with the same status are no-ops for events).
 * - **Unknown SID:** handler still returns **200** so Twilio stops retrying.
 *
 * Set `TWILIO_STATUS_CALLBACK_URL` to this URL (or pass `statusCallback` on outbound `messages.create`) in Twilio / env.
 */
export { POST, runtime, maxDuration } from "@/server/integrations/twilio/twilio-status-webhook";
