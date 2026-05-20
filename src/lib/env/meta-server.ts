import "server-only";

import { metaWebhookEnvSchema, type MetaWebhookEnv } from "@/lib/env/schema";

/**
 * Meta webhook + Graph env (Messenger / Instagram surfaces share the same app secret and verify token).
 * Call from Meta route handlers only — throws ZodError if any key is missing.
 *
 * | Variable | Where used |
 * |----------|------------|
 * | `META_VERIFY_TOKEN` | GET `/api/webhooks/meta` — `hub.verify_token` must match. |
 * | `META_APP_SECRET` | POST — HMAC `X-Hub-Signature-256` over the raw body. |
 * | `META_PAGE_ACCESS_TOKEN` | Outbound Graph sends (scaffolded for future use). |
 */
export function getMetaWebhookEnv(): MetaWebhookEnv {
  return metaWebhookEnvSchema.parse({
    META_APP_SECRET: process.env.META_APP_SECRET,
    META_VERIFY_TOKEN: process.env.META_VERIFY_TOKEN,
    META_PAGE_ACCESS_TOKEN: process.env.META_PAGE_ACCESS_TOKEN,
  });
}
