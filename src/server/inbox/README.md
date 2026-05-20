# Inbox — external channel adapters

Server-only integration layer between webhooks/widget APIs and **`applyInboundMessage`** (`server/messaging/inbound`).

## Adapter contract

Each channel implements **`InboundChannelAdapter<Parsed>`** (`channel-adapter.ts`):

1. **`parseWebhookPayload`** — raw body / route input → typed provider payload (no shared DB types).
2. **`validateProviderRequest`** — required fields, sizes, etc. (cryptographic verification stays on the HTTP handler, e.g. Twilio signature in `server/integrations/twilio/validate-request.ts`.)
3. **`normalize`** — validated payload → **`InboundNormalizedCore`**.
4. **`ingest`** — tenant/thread resolution + **`applyInboundMessage`** + map to **`InboundApplyResult`**.

Use **`parseValidateNormalize(adapter, raw)`** in unit tests or when you want the first three steps without persisting.

## Layout

| Path | Role |
|------|------|
| `src/server/inbox/` | Adapter interfaces + live/scaffold adapters |
| `src/integrations/twilio/` | Twilio-agnostic helpers (form map, field checks, signature util) |
| `src/integrations/meta/` | Meta placeholders for future webhook parse/validate |
| `src/server/messaging/inbound/` | **`applyInboundMessage`**, normalized message types, post-hooks |

Adding a channel: implement the four methods, call **`applyInboundMessage`** from **`ingest`**, register the route under `src/app/api/...` or reuse a generic handler pattern.
