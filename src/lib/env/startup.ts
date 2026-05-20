import "server-only";

import { ZodError } from "zod";

import {
  startupDevelopmentSchema,
  startupProductionSchema,
} from "@/lib/env/schema";
import {
  buildEnvConfigActionMessage,
  formatEnvValidationDetails,
} from "@/lib/env/messages";
import { resolveSupabaseAnonKeyFromEnv } from "@/lib/env/supabase-anon-key";

function throwStartupEnvError(
  mode: "development" | "production",
  error: ZodError
): never {
  const details = formatEnvValidationDetails(error);
  console.error("[env] Invalid %s environment:\n%s", mode, details);
  throw new Error(buildEnvConfigActionMessage(mode));
}

/**
 * Validates configuration when the Node server boots (see `instrumentation.ts`).
 * - **Production**: requires all public + all server secrets (Sentry DSNs optional).
 * - **Development**: requires public vars only. Twilio is optional at boot; set `TWILIO_*` in `.env.local` when
 *   exercising SMS (see `.env.example`). Twilio routes still fail fast via {@link getTwilioServerEnv}.
 *   Other server secrets (e.g. OpenAI) are still validated only when code calls `getServerEnv()`, not at boot.
 *
 * Set `SKIP_ENV_VALIDATION=1` only for exceptional cases (e.g. certain CI image builds); prefer real values or `.env.test`.
 */
export function validateStartupEnv(): void {
  if (process.env.SKIP_ENV_VALIDATION === "1") {
    console.warn(
      "[env] SKIP_ENV_VALIDATION=1 — environment validation was skipped. Do not use in production."
    );
    return;
  }

  const isProduction = process.env.NODE_ENV === "production";

  const raw = {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: resolveSupabaseAnonKeyFromEnv(),
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN ?? "",
    NEXT_PUBLIC_WIDGET_API_KEY: process.env.NEXT_PUBLIC_WIDGET_API_KEY ?? "",
    NEXT_PUBLIC_WIDGET_DEALERSHIP_SLUG:
      process.env.NEXT_PUBLIC_WIDGET_DEALERSHIP_SLUG ?? "sault-nissan",
    NEXT_PUBLIC_WIDGET_API_ORIGIN: process.env.NEXT_PUBLIC_WIDGET_API_ORIGIN ?? "",
    NEXT_PUBLIC_WIDGET_AFTER_HOURS_MESSAGE:
      process.env.NEXT_PUBLIC_WIDGET_AFTER_HOURS_MESSAGE ?? "",
    NEXT_PUBLIC_WIDGET_WELCOME_MESSAGE:
      process.env.NEXT_PUBLIC_WIDGET_WELCOME_MESSAGE ?? "",
    NEXT_PUBLIC_WIDGET_CONTACT_PHONE_TEL:
      process.env.NEXT_PUBLIC_WIDGET_CONTACT_PHONE_TEL ?? "",
    NEXT_PUBLIC_WIDGET_CONTACT_PHONE_LABEL:
      process.env.NEXT_PUBLIC_WIDGET_CONTACT_PHONE_LABEL ?? "",
    NEXT_PUBLIC_WIDGET_CONTACT_EMAIL:
      process.env.NEXT_PUBLIC_WIDGET_CONTACT_EMAIL ?? "",
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
    TWILIO_PHONE_NUMBER: process.env.TWILIO_PHONE_NUMBER,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENAI_BASE_URL: process.env.OPENAI_BASE_URL,
    SENTRY_DSN: process.env.SENTRY_DSN ?? "",
  };

  if (isProduction) {
    const result = startupProductionSchema.safeParse(raw);
    if (!result.success) {
      throwStartupEnvError("production", result.error);
    }
    return;
  }

  const devRaw = {
    NEXT_PUBLIC_SUPABASE_URL: raw.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: raw.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_APP_URL: raw.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_SENTRY_DSN: raw.NEXT_PUBLIC_SENTRY_DSN,
    NEXT_PUBLIC_WIDGET_API_KEY: raw.NEXT_PUBLIC_WIDGET_API_KEY,
    NEXT_PUBLIC_WIDGET_DEALERSHIP_SLUG: raw.NEXT_PUBLIC_WIDGET_DEALERSHIP_SLUG,
    NEXT_PUBLIC_WIDGET_API_ORIGIN: raw.NEXT_PUBLIC_WIDGET_API_ORIGIN,
    NEXT_PUBLIC_WIDGET_AFTER_HOURS_MESSAGE: raw.NEXT_PUBLIC_WIDGET_AFTER_HOURS_MESSAGE,
    NEXT_PUBLIC_WIDGET_WELCOME_MESSAGE: raw.NEXT_PUBLIC_WIDGET_WELCOME_MESSAGE,
    NEXT_PUBLIC_WIDGET_CONTACT_PHONE_TEL: raw.NEXT_PUBLIC_WIDGET_CONTACT_PHONE_TEL,
    NEXT_PUBLIC_WIDGET_CONTACT_PHONE_LABEL: raw.NEXT_PUBLIC_WIDGET_CONTACT_PHONE_LABEL,
    NEXT_PUBLIC_WIDGET_CONTACT_EMAIL: raw.NEXT_PUBLIC_WIDGET_CONTACT_EMAIL,
    TWILIO_ACCOUNT_SID: raw.TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN: raw.TWILIO_AUTH_TOKEN,
    TWILIO_PHONE_NUMBER: raw.TWILIO_PHONE_NUMBER,
  };

  const devResult = startupDevelopmentSchema.safeParse(devRaw);
  if (!devResult.success) {
    throwStartupEnvError("development", devResult.error);
  }
}
