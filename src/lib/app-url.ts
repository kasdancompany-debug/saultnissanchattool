/**
 * Canonical site origin for public redirects (e.g. Supabase auth `redirectTo`).
 * Uses `NEXT_PUBLIC_APP_URL` — no trailing slash.
 */
export function getPublicAppOrigin(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim() ?? "";
  if (!raw) {
    return "";
  }
  return raw.replace(/\/$/, "");
}

/** Full URL for Supabase `resetPasswordForEmail` `redirectTo` (must match Dashboard allow list). */
export function getAuthResetPasswordUrl(): string {
  return `${getPublicAppOrigin()}/auth/reset-password`;
}
