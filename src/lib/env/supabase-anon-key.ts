/**
 * Dashboard may show the public API key as legacy **anon** (JWT) or **publishable** (`sb_publishable_…`).
 * Either value is valid for `@supabase/ssr` / `createClient` — prefer explicit anon when both are set.
 */
export function resolveSupabaseAnonKeyFromEnv(): string {
  const anon = process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"]?.trim();
  const publishable = process.env["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"]?.trim();
  return anon || publishable || "";
}
