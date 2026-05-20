import { createClient } from "@supabase/supabase-js";

import { isSupabaseConfigured, publicEnv } from "@/lib/env/public";
import type { Database } from "@/types/supabase";

export function hasSupabaseServiceRoleKey(): boolean {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());
}

/**
 * Service-role client for privileged server routes (webhooks, background jobs).
 * Never import from client components or expose to the browser.
 */
export function createSupabaseAdminClient() {
  if (!isSupabaseConfigured(publicEnv)) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY."
    );
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!serviceRoleKey) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY. Add it to your server environment (.env.local for local dev) so privileged routes (web widget bundle load, webhooks, admin jobs) can read tenant data."
    );
  }

  return createClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    serviceRoleKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
}
