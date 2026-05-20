# Twilio integrations (shared)

Low-level helpers used by **`src/server/inbox/adapters/twilio-sms.adapter.ts`** and **`src/server/integrations/twilio/`** (HTTP handlers, outbound).

| Module | Purpose |
|--------|---------|
| `webhook-signature.ts` | `validateTwilioWebhookRequest` (auth token + signature + URL + params) |
| `webhook-payload.ts` | Inbound field map checks (`isTwilioFormFieldMap`, `twilioSmsInboundFieldError`) |
| `status-callback.ts` | Status callback: parse `MessageSid` / `MessageStatus` + map to `message_delivery_status` |
| `inbound-form.ts` | `FormData` → flat map, optional `parseInboundSmsFields` |
| `client.ts` | `createTwilioClient` for outbound REST |

Env: required `TWILIO_*` variables are validated in **`getTwilioServerEnv()`** (`src/lib/env/twilio-server.ts`) and at app boot (`src/lib/env/startup.ts`). See `src/server/integrations/twilio/README.md` for the full table.

Signature validation stays on the route (`validate-request.ts` under `server/integrations/twilio`) because it needs the raw `Request` URL.
