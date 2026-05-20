/**
 * Hostnames that look like docs placeholders — they will not resolve (ERR_NAME_NOT_RESOLVED).
 */
const DISALLOWED_SUPABASE_HOSTS = new Set([
  "example.supabase.co",
  "your-project.supabase.co",
]);

/**
 * Returns a user-facing error when `NEXT_PUBLIC_SUPABASE_URL` is a known placeholder or will not work.
 */
export function getSupabasePublicUrlConfigError(url: string): string | null {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (DISALLOWED_SUPABASE_HOSTS.has(host)) {
      return (
        `NEXT_PUBLIC_SUPABASE_URL points at "${host}" (not a real project). ` +
        `Copy the Project URL from Supabase → Project Settings → API into .env.local. ` +
        `On Windows, remove NEXT_PUBLIC_SUPABASE_URL from User/System environment variables if set — those override .env.local. ` +
        `Then delete the .next folder and restart npm run dev.`
      );
    }
    return null;
  } catch {
    return null;
  }
}
