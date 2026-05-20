import { isNextProductionBuild } from "@/lib/env/build-phase";
import { publicEnvSchema } from "@/lib/env/schema";
import type { PublicEnv } from "@/lib/env/schema";
import { resolveSupabaseAnonKeyFromEnv } from "@/lib/env/supabase-anon-key";

/** Used only so `next build` can finish when Vercel env vars are not configured yet. */
const BUILD_PUBLIC_PLACEHOLDERS = {
  NEXT_PUBLIC_SUPABASE_URL: "https://build-placeholder.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "build-placeholder-anon-key",
  NEXT_PUBLIC_APP_URL: "https://build-placeholder.vercel.app",
} as const;

function readPublicEnvRaw() {
  return {
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
  };
}

function mergePublicEnvFallbacks(
  raw: ReturnType<typeof readPublicEnvRaw>
): PublicEnv {
  return publicEnvSchema.parse({
    ...BUILD_PUBLIC_PLACEHOLDERS,
    ...raw,
    NEXT_PUBLIC_SUPABASE_URL:
      raw.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
      BUILD_PUBLIC_PLACEHOLDERS.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY:
      raw.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
      BUILD_PUBLIC_PLACEHOLDERS.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_APP_URL:
      raw.NEXT_PUBLIC_APP_URL?.trim() ||
      BUILD_PUBLIC_PLACEHOLDERS.NEXT_PUBLIC_APP_URL,
  });
}

function readPublicEnv(): PublicEnv {
  const raw = readPublicEnvRaw();
  const parsed = publicEnvSchema.safeParse(raw);
  if (parsed.success) {
    return parsed.data;
  }

  if (isNextProductionBuild()) {
    console.warn(
      "[env] Missing or invalid NEXT_PUBLIC_* during build — using placeholders. " +
        "Add environment variables in Vercel (Project Settings → Environment Variables) for Production and Preview, then redeploy."
    );
  } else {
    console.warn(
      "[env] Missing or invalid NEXT_PUBLIC_* — app will load but sign-in stays disabled until Supabase env is set."
    );
  }

  return mergePublicEnvFallbacks(raw);
}

/**
 * Public (browser-safe) configuration. Only `NEXT_PUBLIC_*` values.
 * Never throws — missing values use placeholders and {@link isSupabaseConfigured} stays false.
 */
export const publicEnv: PublicEnv = readPublicEnv();

export type { PublicEnv };

export function isBuildPlaceholderEnv(env: PublicEnv): boolean {
  return (
    env.NEXT_PUBLIC_SUPABASE_URL.includes("build-placeholder") ||
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY === "build-placeholder-anon-key"
  );
}

export function isSupabaseConfigured(
  env: PublicEnv = publicEnv
): env is PublicEnv & {
  NEXT_PUBLIC_SUPABASE_URL: string;
  NEXT_PUBLIC_SUPABASE_ANON_KEY: string;
} {
  if (isBuildPlaceholderEnv(env)) {
    return false;
  }
  try {
    new URL(env.NEXT_PUBLIC_SUPABASE_URL);
    return env.NEXT_PUBLIC_SUPABASE_ANON_KEY.length > 0;
  } catch {
    return false;
  }
}
