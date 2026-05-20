import { z } from "zod";

/** E.164 for Twilio `TWILIO_PHONE_NUMBER` (default `From` line + dealership routing fallback). */
const twilioPhoneE164 = z
  .string()
  .regex(
    /^\+[1-9]\d{6,14}$/,
    "TWILIO_PHONE_NUMBER must be E.164 (e.g. +17055550100)"
  );

/**
 * Required Twilio credentials (server-only; never `NEXT_PUBLIC_*`).
 * @see `src/lib/env/twilio-server.ts` — where to read these at runtime.
 * @see `src/server/integrations/twilio/README.md` — where each value is used in the app.
 */
export const twilioServerEnvSchema = z.object({
  /** Twilio REST account identifier; used with `TWILIO_AUTH_TOKEN` for `twilio` SDK and API calls. */
  TWILIO_ACCOUNT_SID: z
    .string()
    .min(1, "TWILIO_ACCOUNT_SID is required (Twilio Console → Account)."),
  /** Primary auth token: webhook signature validation (`X-Twilio-Signature`) and REST API authentication. */
  TWILIO_AUTH_TOKEN: z
    .string()
    .min(1, "TWILIO_AUTH_TOKEN is required (Account → Auth token; treat as a secret)."),
  /** Default outbound `From` E.164 when a dealership line is omitted; also used for single-tenant inbound `To` fallback routing. */
  TWILIO_PHONE_NUMBER: twilioPhoneE164,
});

export type TwilioServerEnv = z.infer<typeof twilioServerEnvSchema>;

/**
 * Meta (Messenger / Instagram) webhooks and Graph API.
 * Validated via {@link getMetaWebhookEnv} when Meta routes run — not merged into {@link serverSecretsSchema}
 * so deployments without Meta stay valid.
 */
export const metaWebhookEnvSchema = z.object({
  /** Used to verify `X-Hub-Signature-256` on webhook POST bodies. */
  META_APP_SECRET: z
    .string()
    .min(1, "META_APP_SECRET is required for Meta webhook POST signature verification."),
  /** Must match `hub.verify_token` during GET subscription verification. */
  META_VERIFY_TOKEN: z
    .string()
    .min(1, "META_VERIFY_TOKEN is required for Meta webhook GET verification."),
  /**
   * Page access token for Graph API sends (Messenger). Reserved for outbound; required here so
   * misconfiguration is caught when webhook handlers load.
   */
  META_PAGE_ACCESS_TOKEN: z
    .string()
    .min(1, "META_PAGE_ACCESS_TOKEN is required for Meta Graph outbound (not used by webhook POST yet)."),
});

export type MetaWebhookEnv = z.infer<typeof metaWebhookEnvSchema>;

/**
 * Variables embedded in the client bundle (prefixed NEXT_PUBLIC_).
 * Safe to import from Client Components — never add secrets here.
 */
export const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_APP_URL: z.string().url(),
  /** Browser Sentry SDK; optional. Use the same DSN project key as `SENTRY_DSN` when enabling client reporting. */
  NEXT_PUBLIC_SENTRY_DSN: z.union([z.string().url(), z.literal("")]).default(""),
  /** Must match server `WIDGET_API_KEY` when the widget API enforces the site key. */
  NEXT_PUBLIC_WIDGET_API_KEY: z.string().default(""),
  /** Default dealership slug for `/widget` embed (`?slug=` overrides). */
  NEXT_PUBLIC_WIDGET_DEALERSHIP_SLUG: z.string().min(1).default("sault-nissan"),
  /** Override API origin for cross-domain embeds; empty = use `NEXT_PUBLIC_APP_URL`. */
  NEXT_PUBLIC_WIDGET_API_ORIGIN: z.union([z.string().url(), z.literal("")]).default(""),
  /** Shown when outside configured business hours. */
  NEXT_PUBLIC_WIDGET_AFTER_HOURS_MESSAGE: z.string().default(""),
  /** Welcome line in the chat panel. */
  NEXT_PUBLIC_WIDGET_WELCOME_MESSAGE: z.string().default(""),
  /** E.164 for tel: link in after-hours CTA (e.g. +17055550100). */
  NEXT_PUBLIC_WIDGET_CONTACT_PHONE_TEL: z.string().default(""),
  /** Display label for phone CTA (e.g. (705) 555-0100). */
  NEXT_PUBLIC_WIDGET_CONTACT_PHONE_LABEL: z.string().default(""),
  /** Email for after-hours CTA. */
  NEXT_PUBLIC_WIDGET_CONTACT_EMAIL: z.string().default(""),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;

/**
 * OpenAI-compatible API root: must include the `/v1` segment (no trailing slash).
 * @example Official OpenAI: `https://api.openai.com/v1`
 * @example Groq: `https://api.groq.com/openai/v1`
 * @example OpenRouter: `https://openrouter.ai/api/v1`
 */
export const openaiCompatibleBaseUrlSchema = z.preprocess((v) => {
  const s = typeof v === "string" ? v.trim() : "";
  return (s.length > 0 ? s : "https://api.openai.com/v1").replace(/\/+$/, "");
}, z.string().url());

/**
 * Server-only secrets (no NEXT_PUBLIC_ prefix). Never import this object from client code.
 */
export const serverSecretsSchema = z
  .object({
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
    /** Public URL for outbound SMS status callbacks (Twilio `statusCallback`). */
    TWILIO_STATUS_CALLBACK_URL: z.union([z.string().url(), z.literal("")]).default(""),
    /** Bearer token for `POST /api/webhooks/telephony/missed-call`. Empty disables the route. */
    MISSED_CALL_WEBHOOK_SECRET: z.string().default(""),
    /** Overrides default missed-call follow-up SMS body. */
    MISSED_CALL_FOLLOWUP_SMS: z.string().default(""),
    OPENAI_API_KEY: z.string().min(1),
    OPENAI_BASE_URL: openaiCompatibleBaseUrlSchema,
  /** Inbound message classification model (Chat Completions). */
  AI_MODEL: z.string().default("gpt-4o-mini"),
  /** Escalate when model confidence is below this (0–1). */
  AI_CONFIDENCE_THRESHOLD: z.string().default("0.65"),
  /** Set to "false" to disable inbound AI runs (still stores nothing). */
  AI_INBOUND_CLASSIFICATION_ENABLED: z.string().default("true"),
  /** Reserved: auto-send AI drafts (not implemented; must stay false in production until wired). */
  AI_AUTO_SEND_REPLIES: z.string().default("false"),
  /**
   * When not "false", allows a single sanitized AI customer-visible reply on **after-hours web widget**
   * threads (service intake / expectation-setting). Staff claim or reply disables this path.
   */
  AI_SERVICE_AFTER_HOURS_AUTOREPLY: z.string().default("true"),
  /** Server/edge Sentry. Empty disables server/edge error reporting for that process. */
  SENTRY_DSN: z.union([z.string().url(), z.literal("")]).default(""),
})
  .merge(twilioServerEnvSchema);

export type ServerSecrets = z.infer<typeof serverSecretsSchema>;

/**
 * Inbound OpenAI classification + `openaiChatCompletionsJson` only.
 * Intentionally **does not** require Twilio or `SUPABASE_SERVICE_ROLE_KEY` so the web widget can run
 * AI (with OpenAI) before SMS or full server env is configured. Full routes still use {@link getServerEnv}.
 */
export const inboundClassificationEnvSchema = z.object({
  /** Trim so accidental spaces in `.env` do not look “set” and fail at OpenAI HTTP. */
  OPENAI_API_KEY: z.preprocess(
    (v) => (typeof v === "string" ? v.trim() : v),
    z
      .string()
      .min(1, "Set OPENAI_API_KEY in the server environment (e.g. .env.local) for widget and inbound AI.")
  ),
  OPENAI_BASE_URL: openaiCompatibleBaseUrlSchema,
  AI_MODEL: z.string().default("gpt-4o-mini"),
  AI_CONFIDENCE_THRESHOLD: z.string().default("0.65"),
  AI_INBOUND_CLASSIFICATION_ENABLED: z.string().default("true"),
  AI_SERVICE_AFTER_HOURS_AUTOREPLY: z.string().default("true"),
});

export type InboundClassificationEnv = z.infer<typeof inboundClassificationEnvSchema>;

/**
 * Development startup: public URLs + Supabase client keys; Twilio optional here and validated via
 * {@link getTwilioServerEnv} when SMS paths run.
 */
export const startupDevelopmentSchema = publicEnvSchema.merge(twilioServerEnvSchema.partial());

/** @deprecated Use {@link startupDevelopmentSchema}; kept for callers that only meant “public dev”. */
export const startupDevSchema = startupDevelopmentSchema;

/** Full server contract (Twilio routes, privileged jobs). */
export const startupProductionSchema = publicEnvSchema.merge(serverSecretsSchema);

/**
 * Vercel/server boot — public Supabase + core AI only. Twilio is validated when SMS/webhooks run.
 */
export const startupProductionBootSchema = publicEnvSchema.merge(
  z.object({
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
    OPENAI_API_KEY: z.string().min(1),
    OPENAI_BASE_URL: openaiCompatibleBaseUrlSchema,
    AI_MODEL: z.string().default("gpt-4o-mini"),
    AI_CONFIDENCE_THRESHOLD: z.string().default("0.65"),
    AI_INBOUND_CLASSIFICATION_ENABLED: z.string().default("true"),
    AI_SERVICE_AFTER_HOURS_AUTOREPLY: z.string().default("true"),
    SENTRY_DSN: z.union([z.string().url(), z.literal("")]).default(""),
  })
);

export type StartupProductionEnv = z.infer<typeof startupProductionSchema>;
