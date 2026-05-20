# Twilio SMS integration (dealership inbox)

Twilio-specific code lives under `src/server/integrations/twilio`. Low-level SDK helpers stay in `src/integrations/twilio`. **Do not** call Twilio from React components; use server actions / route handlers only.

## Webhook URLs (Twilio Console)

Configure these **HTTP POST** webhooks on your Twilio phone number (or Messaging Service):

| Purpose | Path |
|--------|------|
| Inbound SMS (canonical) | `https://<your-host>/api/webhooks/twilio/inbound` |
| Inbound SMS (legacy alias) | `https://<your-host>/api/webhooks/twilio/sms` |
| Status callbacks (optional) | `https://<your-host>/api/webhooks/twilio/status` |

- Twilio sends `application/x-www-form-urlencoded`; Next.js exposes it as `FormData`.
- Inbound handlers respond with **empty TwiML** on success (Twilio expects 200 + valid TwiML for SMS webhooks).
- Inbound payload/domain validation failures also return **200 + empty TwiML** so malformed/replayed payloads do not trigger retry storms.
- Signature validation uses the **exact public URL** Twilio called (path + query + `https`), including reverse-proxy headers (`x-forwarded-proto`, `x-forwarded-host`). Mismatched URLs cause **403 Forbidden**.

## Environment variables (server-only)

Never prefix Twilio secrets with `NEXT_PUBLIC_` — they must not reach the browser bundle.

**Validation**

- **Development**: `instrumentation.ts` → `validateStartupEnv()` requires `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_PHONE_NUMBER` (plus public `NEXT_PUBLIC_*`). Missing or invalid values throw at boot with Zod paths/messages.
- **Production**: full `serverSecretsSchema` (includes the same Twilio fields) is validated at boot.
- **Runtime (Twilio-only)**: `getTwilioServerEnv()` in `@/lib/env/twilio-server` parses the three required vars so webhooks/SMS can fail clearly without calling `getServerEnv()` (which also requires OpenAI, Supabase service role, etc.).
- **Webhook misconfiguration response**: inbound/status handlers return **503** with a consistent operator-facing message when `TWILIO_*` is missing/invalid.

| Variable | Used in |
|----------|---------|
| `TWILIO_ACCOUNT_SID` | `createTwilioClient()` (`src/integrations/twilio/client.ts`) — passed to the Twilio SDK constructor for REST sends. |
| `TWILIO_AUTH_TOKEN` | SDK constructor with `TWILIO_ACCOUNT_SID`; `validateTwilioWebhookSignature` in inbound/status handlers (`inbound-sms-webhook.ts`, `twilio-status-webhook.ts`) for `X-Twilio-Signature`. |
| `TWILIO_PHONE_NUMBER` | Default **`From`** on outbound SMS (`createTwilioClient`); default “from” line in `sendTwilioOutboundSms` when the dealership line is omitted; **single-tenant fallback** when inbound `To` matches this number and exactly one dealership exists (`resolveDealershipIdFromDialedNumber`). Must be **E.164** (e.g. `+17055550100`). |
| `TWILIO_STATUS_CALLBACK_URL` | Optional; read in `createTwilioClient` from `process.env` (not part of `getTwilioServerEnv`). Passed to `messages.create` as `statusCallback` when set. |

Dealership routing for inbound uses the webhook **`To`** number: **`dealership_channel_accounts`** (`provider = twilio_sms`, `external_account_id` = E.164), then legacy `dealerships.twilio_phone_e164` (see `resolveDealershipIdFromDialedNumber`). Outbound `From` uses the same table first, then the dealership column, then env default.

### Shared number now, multi-number later

- **Now (shared line):** keep one active `twilio_sms` channel-account row for the dealership; all inbound routes through that shared public number.
- **Later (department lines):** add more active `twilio_sms` rows (one per Twilio number). Inbound routing still resolves by `To` E.164, so each number maps deterministically to one channel account.
- Optional per-line metadata supports internal routing:
  - `metadata.inbound_department` (or `metadata.default_department`) can set the initial conversation department (e.g. `sales`, `service`) for **new** threads.
- No per-salesperson numbers are required; ownership remains internal via `conversations.assigned_to_user_id`.

## Inbound flow

1. `parseTwilioWebhookFormBody` → flat string map  
2. `validateTwilioWebhookSignature`  
3. `normalizeTwilioInboundSms` → Twilio-specific SMS shape (`NormalizedInboundSms`)  
4. `processTwilioInboundSms` → `twilioSmsInboundAdapter.ingest` → builds **`InboundNormalizedCore`** + `dealershipId` → **`applyInboundMessage()`** (find/create customer + conversation, dedupe, insert message, hooks). **`conversations.last_message_at`** is updated by the DB trigger on `messages` insert.

## Outbound flow

1. Staff reply → `sendStaffReply` → for **SMS** threads, `sendStaffSmsForConversation` (persist + `sendTwilioOutboundSms` + row update)  
2. For other channels, `twilioOutboundSmsTransport` / internal transport after the message row exists  
3. `twilio_outbound_sid` + `delivery_status` on the `messages` row; `human_reply_sent` comes from `createMessage`  
4. Optional status webhook → `POST /api/webhooks/twilio/status` → `applyTwilioMessageStatus` updates `messages.delivery_status` by `twilio_outbound_sid` (= Twilio `MessageSid`), merges `metadata.transport`, and logs `metadata_changed` when delivery status **changes** (see `src/integrations/twilio/status-callback.ts` for Twilio → enum mapping).

## Development integration test (inbound pipeline)

- **Script:** `npm run test:twilio-inbound` (Vitest) runs `test/integration/twilio-inbound-pipeline.test.ts`, which calls **`processTwilioInboundSms`** with a Twilio-shaped field map (no HTTP, no signature).
- **Safety:** the suite is **skipped** unless `DEV_TWILIO_INBOUND_PIPELINE_TEST_ALLOW=1`. Use only on **local or disposable** Supabase (`supabase start` or a dev project), never production.
- **Env:** `test/vitest.setup.ts` loads `.env.local` when present; requires `NEXT_PUBLIC_SUPABASE_*` and `SUPABASE_SERVICE_ROLE_KEY` like other dev scripts.
- **Vitest + `server-only`:** `vitest.config.ts` aliases `server-only` to `test/shims/server-only.ts` so the real server modules load under Node (Next’s bundler normally strips `server-only` on the server).

## Meta / future channels

Keep provider adapters in `src/server/integrations/<provider>/` and map into the same `createMessage` + transport patterns so the inbox UI stays channel-agnostic.
