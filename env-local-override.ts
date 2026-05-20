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
export function getNextPublicEnvForNextConfig(): Record<string, string> {
  return parseNextPublicFromEnvLocalFile();
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
