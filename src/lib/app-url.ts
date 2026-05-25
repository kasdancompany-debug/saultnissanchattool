import { readSupabasePublicRuntimeConfigFromDom } from "@/lib/env/supabase-public-runtime";

/**
 * Canonical site origin for public redirects (e.g. Supabase auth `redirectTo`).
 * Uses server-injected config first, then `NEXT_PUBLIC_APP_URL` — no trailing slash.
 */
export function getPublicAppOrigin(): string {
  const injected = readSupabasePublicRuntimeConfigFromDom();
  const raw =
    injected?.appUrl?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim() || "";
  if (!raw) {
    return "";
  }
  return raw.replace(/\/$/, "");
}

/** Full URL for Supabase `resetPasswordForEmail` `redirectTo` (must match Dashboard allow list). */
export function getAuthResetPasswordUrl(): string {
  return `${getPublicAppOrigin()}/auth/reset-password`;
}
