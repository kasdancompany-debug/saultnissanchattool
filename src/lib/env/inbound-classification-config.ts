import {
  inboundClassificationEnvSchema,
  type InboundClassificationEnv,
} from "@/lib/env/schema";

/**
 * Inbound OpenAI env (no `server-only` gate) so {@link WidgetPage} can read `process.env`
 * without importing `@/lib/env/server` — that import can break the App Router / RSC bundle with 500s.
 */
export function readInboundClassificationEnvFromProcess() {
  return {
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENAI_BASE_URL: process.env.OPENAI_BASE_URL,
    AI_MODEL: process.env.AI_MODEL,
    AI_CONFIDENCE_THRESHOLD: process.env.AI_CONFIDENCE_THRESHOLD,
    AI_INBOUND_CLASSIFICATION_ENABLED:
      process.env.AI_INBOUND_CLASSIFICATION_ENABLED,
    AI_SERVICE_AFTER_HOURS_AUTOREPLY: process.env.AI_SERVICE_AFTER_HOURS_AUTOREPLY,
  };
}

export function getInboundClassificationEnv(): InboundClassificationEnv {
  return inboundClassificationEnvSchema.parse(
    readInboundClassificationEnvFromProcess()
  );
}

export function isInboundOpenAiConfigured(): boolean {
  return inboundClassificationEnvSchema.safeParse(
    readInboundClassificationEnvFromProcess()
  ).success;
}
