import { hasSupabaseServiceRoleKey } from "@/integrations/supabase/admin";
import { isInboundOpenAiConfigured } from "@/lib/env/inbound-classification-config";
import { isSupabaseConfiguredAtRuntime } from "@/lib/env/public";
import { resolveSupabaseAnonKeyFromEnv } from "@/lib/env/supabase-anon-key";
import { isWidgetConfigured } from "@/lib/env/widget";

export const dynamic = "force-dynamic";

/** Temporary: verify Vercel runtime env (no secret values). */
export async function GET() {
  const supUrl = process.env.SUPABASE_URL?.trim() ?? "";
  const supAnon = process.env.SUPABASE_ANON_KEY?.trim() ?? "";
  const pubUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const pubAnon = resolveSupabaseAnonKeyFromEnv();

  const pubPublishable =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ?? "";

  return Response.json({
    runtime_check: isSupabaseConfiguredAtRuntime(),
    has_SUPABASE_URL: supUrl.length > 0,
    has_SUPABASE_ANON_KEY: supAnon.length > 0,
    has_NEXT_PUBLIC_SUPABASE_URL: pubUrl.length > 0,
    has_NEXT_PUBLIC_SUPABASE_ANON_KEY:
      (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "").length > 0,
    has_NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: pubPublishable.length > 0,
    has_resolved_anon_key: pubAnon.length > 0,
    supabase_url_is_placeholder:
      supUrl.includes("build-placeholder") || pubUrl.includes("build-placeholder"),
    widget_api_configured: isWidgetConfigured(),
    openai_inbound_configured: isInboundOpenAiConfigured(),
    has_WIDGET_SESSION_SECRET: (process.env.WIDGET_SESSION_SECRET?.trim() ?? "").length >= 32,
    has_OPENAI_API_KEY: (process.env.OPENAI_API_KEY?.trim() ?? "").length > 0,
    has_SUPABASE_SERVICE_ROLE_KEY: hasSupabaseServiceRoleKey(),
  });
}
