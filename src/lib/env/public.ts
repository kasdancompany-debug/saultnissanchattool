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

/** Prefix split so Next.js does not inline build-time placeholders into server bundles. */
const NEXT_PUBLIC_PREFIX = "NEXT_PUBLIC_";

/** Dynamic access so Next does not bake placeholders into server bundles at build time. */
function runtimeEnv(suffix: string): string | undefined {
  return process.env[`${NEXT_PUBLIC_PREFIX}${suffix}`];
}

function readPublicEnvRaw() {
  return {
    NEXT_PUBLIC_SUPABASE_URL: runtimeEnv("SUPABASE_URL"),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: resolveSupabaseAnonKeyFromEnv(),
    NEXT_PUBLIC_APP_URL: runtimeEnv("APP_URL"),
    NEXT_PUBLIC_SENTRY_DSN: runtimeEnv("SENTRY_DSN") ?? "",
    NEXT_PUBLIC_WIDGET_API_KEY: runtimeEnv("WIDGET_API_KEY") ?? "",
    NEXT_PUBLIC_WIDGET_DEALERSHIP_SLUG:
      runtimeEnv("WIDGET_DEALERSHIP_SLUG") ?? "sault-nissan",
    NEXT_PUBLIC_WIDGET_API_ORIGIN: runtimeEnv("WIDGET_API_ORIGIN") ?? "",
    NEXT_PUBLIC_WIDGET_AFTER_HOURS_MESSAGE:
      runtimeEnv("WIDGET_AFTER_HOURS_MESSAGE") ?? "",
    NEXT_PUBLIC_WIDGET_WELCOME_MESSAGE:
      runtimeEnv("WIDGET_WELCOME_MESSAGE") ?? "",
    NEXT_PUBLIC_WIDGET_CONTACT_PHONE_TEL:
      runtimeEnv("WIDGET_CONTACT_PHONE_TEL") ?? "",
    NEXT_PUBLIC_WIDGET_CONTACT_PHONE_LABEL:
      runtimeEnv("WIDGET_CONTACT_PHONE_LABEL") ?? "",
    NEXT_PUBLIC_WIDGET_CONTACT_EMAIL:
      runtimeEnv("WIDGET_CONTACT_EMAIL") ?? "",
  };
}

const corePublicEnvSchema = publicEnvSchema.pick({
  NEXT_PUBLIC_SUPABASE_URL: true,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: true,
  NEXT_PUBLIC_APP_URL: true,
});

/** Blank or invalid optional URL fields should not block Supabase auth. */
function sanitizeOptionalPublicUrls(
  raw: ReturnType<typeof readPublicEnvRaw>
): ReturnType<typeof readPublicEnvRaw> {
  const optionalUrlKeys = [
    "NEXT_PUBLIC_SENTRY_DSN",
    "NEXT_PUBLIC_WIDGET_API_ORIGIN",
  ] as const;
  const next = { ...raw };
  for (const key of optionalUrlKeys) {
    const value = next[key]?.trim();
    if (!value) {
      next[key] = "";
      continue;
    }
    try {
      new URL(value);
    } catch {
      next[key] = "";
    }
  }
  return next;
}

function parsePublicEnv(raw: ReturnType<typeof readPublicEnvRaw>): PublicEnv {
  const sanitized = sanitizeOptionalPublicUrls(raw);
  const parsed = publicEnvSchema.safeParse(sanitized);
  if (parsed.success) {
    return parsed.data;
  }

  const core = corePublicEnvSchema.safeParse(sanitized);
  if (core.success) {
    return publicEnvSchema.parse({
      ...sanitized,
      ...core.data,
    });
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

  return mergePublicEnvFallbacks(sanitized);
}

/** True when Supabase public env is present in the live process environment. */
export function isSupabaseConfiguredAtRuntime(): boolean {
  const raw = readPublicEnvRaw();
  const url = raw.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const key = raw.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";
  if (!url || !key || url.includes("build-placeholder") || key === "build-placeholder-anon-key") {
    return false;
  }
  try {
    new URL(url);
    return key.length > 0;
  } catch {
    return false;
  }
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
  return parsePublicEnv(readPublicEnvRaw());
}

/**
 * Build-time snapshot (client bundle / static analysis). May use placeholders when env is missing.
 */
export const publicEnv: PublicEnv = readPublicEnv();

/**
 * Fresh read from `process.env` on the server (avoids Next inlining stale build-time values).
 */
export function getPublicEnv(): PublicEnv {
  return parsePublicEnv(readPublicEnvRaw());
}

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
