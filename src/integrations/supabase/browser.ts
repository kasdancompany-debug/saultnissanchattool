"use client";

import { createBrowserClient } from "@supabase/ssr";

import { mergeClientPublicEnv } from "@/lib/env/client-public-runtime";
import type { ClientPublicRuntimeConfig } from "@/lib/env/client-public-runtime";
import { publicEnv } from "@/lib/env/public";
import { getSupabasePublicUrlConfigError } from "@/lib/env/supabase-public-url";
import type { Database } from "@/types/supabase";

/**
 * Resolve the public Supabase API key: prefer server-injected runtime config (Vercel
 * `SUPABASE_*` aliases), then `NEXT_PUBLIC_*` inlined at build.
 */
function resolveSupabaseBrowserCredentials(
  override?: Pick<ClientPublicRuntimeConfig, "url" | "anonKey"> | null
): { url: string; key: string } | null {
  const merged = mergeClientPublicEnv(publicEnv);
  const url = override?.url?.trim() || merged.NEXT_PUBLIC_SUPABASE_URL?.trim() || "";
  const key =
    override?.anonKey?.trim() || merged.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || "";
  if (!url || !key || url.includes("build-placeholder")) return null;
  return { url, key };
}

export function createSupabaseBrowserClient(
  override?: Pick<ClientPublicRuntimeConfig, "url" | "anonKey"> | null
) {
  const creds = resolveSupabaseBrowserCredentials(override);
  if (!creds) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY."
    );
  }

  const urlError = getSupabasePublicUrlConfigError(creds.url);
  if (urlError) {
    throw new Error(urlError);
  }

  return createBrowserClient<Database>(creds.url, creds.key, {
    // Default singleton can keep a stale client across HMR / env fixes (wrong apikey until hard refresh).
    isSingleton: false,
  });
}
