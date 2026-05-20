import { publicEnvSchema } from "@/lib/env/schema";
import type { PublicEnv } from "@/lib/env/schema";
import { resolveSupabaseAnonKeyFromEnv } from "@/lib/env/supabase-anon-key";

function readPublicEnv(): PublicEnv {
  return publicEnvSchema.parse({
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
  });
}

/**
 * Public (browser-safe) configuration. Only `NEXT_PUBLIC_*` values.
 * @throws {z.ZodError} if public variables are invalid — typically after `validateStartupEnv` in production.
 */
export const publicEnv: PublicEnv = readPublicEnv();

export type { PublicEnv };

export function isSupabaseConfigured(
  env: PublicEnv = publicEnv
): env is PublicEnv & {
  NEXT_PUBLIC_SUPABASE_URL: string;
  NEXT_PUBLIC_SUPABASE_ANON_KEY: string;
} {
  try {
    new URL(env.NEXT_PUBLIC_SUPABASE_URL);
    return env.NEXT_PUBLIC_SUPABASE_ANON_KEY.length > 0;
  } catch {
    return false;
  }
}
