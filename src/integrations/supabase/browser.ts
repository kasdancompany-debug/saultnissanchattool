"use client";

import { createBrowserClient } from "@supabase/ssr";

import { getSupabasePublicUrlConfigError } from "@/lib/env/supabase-public-url";
import type { Database } from "@/types/supabase";

/**
 * Resolve the public Supabase API key here with direct `process.env.NEXT_PUBLIC_*` reads so
 * webpack always inlines literals for the client bundle. Indirect resolution via `publicEnv`
 * can mis-resolve after env/HMR changes. Prefer anon JWT, else publishable key.
 */
function getSupabasePublicKeyFromEnv(): string {
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";
  const publishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ?? "";
  return anon || publishable;
}

export function createSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const urlError = getSupabasePublicUrlConfigError(url);
  if (urlError) {
    throw new Error(urlError);
  }

  const key = getSupabasePublicKeyFromEnv();
  if (!url || !key) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY."
    );
  }

  return createBrowserClient<Database>(url, key, {
    // Default singleton can keep a stale client across HMR / env fixes (wrong apikey until hard refresh).
    isSingleton: false,
  });
}
