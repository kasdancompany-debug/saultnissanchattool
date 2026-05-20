/**
 * **Meta webhooks** — Messenger (`object: page`) and Instagram (`object: instagram`).
 *
 * - **GET** — subscription verification (`hub.mode`, `hub.verify_token`, `hub.challenge`); token must match `META_VERIFY_TOKEN`.
 * - **POST** — validates `X-Hub-Signature-256` with `META_APP_SECRET`, parses JSON, routes to product-specific parsers (stubs).
 *
 * Configure in Meta App Dashboard → Webhooks → Callback URL: `{NEXT_PUBLIC_APP_URL}/api/webhooks/meta`.
 *
 * Implementation lives under `src/server/integrations/meta/` (not in this file).
 */
export { GET, POST, runtime, maxDuration } from "@/server/integrations/meta/meta-webhook-route";
