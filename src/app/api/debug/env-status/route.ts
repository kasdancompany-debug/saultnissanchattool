import { isSupabaseConfiguredAtRuntime } from "@/lib/env/public";
import { resolveSupabaseAnonKeyFromEnv } from "@/lib/env/supabase-anon-key";

export const dynamic = "force-dynamic";

/** Temporary: verify Vercel runtime env (no secret values). */
export async function GET() {
  const supUrl = process.env.SUPABASE_URL?.trim() ?? "";
  const supAnon = process.env.SUPABASE_ANON_KEY?.trim() ?? "";
  const pubUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const pubAnon = resolveSupabaseAnonKeyFromEnv();

  return Response.json({
    runtime_check: isSupabaseConfiguredAtRuntime(),
    has_SUPABASE_URL: supUrl.length > 0,
    has_SUPABASE_ANON_KEY: supAnon.length > 0,
    has_NEXT_PUBLIC_SUPABASE_URL: pubUrl.length > 0,
    has_resolved_anon_key: pubAnon.length > 0,
    supabase_url_is_placeholder: supUrl.includes("build-placeholder") || pubUrl.includes("build-placeholder"),
  });
}
