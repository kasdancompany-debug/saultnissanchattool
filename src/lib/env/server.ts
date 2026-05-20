import "server-only";

import {
  getInboundClassificationEnv,
  isInboundOpenAiConfigured,
} from "@/lib/env/inbound-classification-config";
import type { ServerSecrets } from "@/lib/env/schema";
import { serverSecretsSchema } from "@/lib/env/schema";

/**
 * Re-exported for call sites that already import from `@/lib/env/server`.
 * Implementation lives in `inbound-classification-config` (not `server-only`) so `/widget` can
 * use `isInboundOpenAiConfigured` without a 500 from the RSC + `server` boundary.
 */
export { getInboundClassificationEnv, isInboundOpenAiConfigured };

/**
 * Privileged server secrets. Throws if any key is missing or invalid when called.
 * Use only from Server Components, Server Actions, Route Handlers, and `server-only` modules.
 *
 * For **Twilio-only** reads (webhooks, outbound SMS, line routing), prefer **`getTwilioServerEnv`**
 * (`@/lib/env/twilio-server`) so missing `TWILIO_*` fails without requiring unrelated keys (e.g. OpenAI).
 */

export function getServerEnv(): ServerSecrets {
  return serverSecretsSchema.parse({
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
    TWILIO_PHONE_NUMBER: process.env.TWILIO_PHONE_NUMBER,
    TWILIO_STATUS_CALLBACK_URL: process.env.TWILIO_STATUS_CALLBACK_URL ?? "",
    MISSED_CALL_WEBHOOK_SECRET: process.env.MISSED_CALL_WEBHOOK_SECRET ?? "",
    MISSED_CALL_FOLLOWUP_SMS: process.env.MISSED_CALL_FOLLOWUP_SMS ?? "",
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENAI_BASE_URL: process.env.OPENAI_BASE_URL,
    AI_MODEL: process.env.AI_MODEL ?? "gpt-4o-mini",
    AI_CONFIDENCE_THRESHOLD: process.env.AI_CONFIDENCE_THRESHOLD ?? "0.65",
    AI_INBOUND_CLASSIFICATION_ENABLED:
      process.env.AI_INBOUND_CLASSIFICATION_ENABLED ?? "true",
    AI_AUTO_SEND_REPLIES: process.env.AI_AUTO_SEND_REPLIES ?? "false",
    AI_SERVICE_AFTER_HOURS_AUTOREPLY:
      process.env.AI_SERVICE_AFTER_HOURS_AUTOREPLY ?? "true",
    SENTRY_DSN: process.env.SENTRY_DSN ?? "",
  });
}
