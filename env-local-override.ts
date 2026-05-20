import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Next's `loadEnvConfig` does **not** override keys already present in `process.env`.
 * On Windows, User/System env vars can win over `.env.local` and break the browser client.
 *
 * We (1) merge `.env.local` into `process.env` and (2) expose the same values via
 * `next.config.ts` `env` so webpack **must** embed those literals for the client bundle.
 */
const SUPABASE_PUBLIC_KEY_VARS = [
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
] as const;

/** Parse `NEXT_PUBLIC_*` assignments from `.env.local` (same rules as apply). */
export function parseNextPublicFromEnvLocalFile(): Record<string, string> {
  const p = join(process.cwd(), ".env.local");
  if (!existsSync(p)) return {};

  const out: Record<string, string> = {};
  const lines = readFileSync(p, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    if (!key.startsWith("NEXT_PUBLIC_")) continue;
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

/**
 * Values for `next.config.js` `env` — forces client bundle to use `.env.local` for these keys
 * even when Windows pollutes `process.env` before Next starts.
 */
const NEXT_PUBLIC_KEYS_FOR_CONFIG = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_SENTRY_DSN",
  "NEXT_PUBLIC_WIDGET_API_KEY",
  "NEXT_PUBLIC_WIDGET_DEALERSHIP_SLUG",
  "NEXT_PUBLIC_WIDGET_API_ORIGIN",
  "NEXT_PUBLIC_WIDGET_AFTER_HOURS_MESSAGE",
  "NEXT_PUBLIC_WIDGET_WELCOME_MESSAGE",
  "NEXT_PUBLIC_WIDGET_CONTACT_PHONE_TEL",
  "NEXT_PUBLIC_WIDGET_CONTACT_PHONE_LABEL",
  "NEXT_PUBLIC_WIDGET_CONTACT_EMAIL",
] as const;

/**
 * Values for `next.config` `env` — prefers `.env.local`, then `process.env` (Vercel build).
 */
export function getNextPublicEnvForNextConfig(): Record<string, string> {
  const fromFile = parseNextPublicFromEnvLocalFile();
  const out: Record<string, string> = { ...fromFile };
  for (const key of NEXT_PUBLIC_KEYS_FOR_CONFIG) {
    const fromEnv = process.env[key]?.trim();
    if (fromEnv && !out[key]) {
      out[key] = fromEnv;
    }
  }

  const anon = out.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  const publishable = out.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  const resolved = anon || publishable;
  if (resolved) {
    out.NEXT_PUBLIC_SUPABASE_ANON_KEY = resolved;
  }

  return out;
}

export function applyEnvLocalOverrides(): void {
  const parsed = parseNextPublicFromEnvLocalFile();
  const keysSettledFromFile = new Set(Object.keys(parsed));

  for (const [key, val] of Object.entries(parsed)) {
    process.env[key] = val;
  }

  for (const k of SUPABASE_PUBLIC_KEY_VARS) {
    if (!keysSettledFromFile.has(k)) {
      delete process.env[k];
    }
  }
}
