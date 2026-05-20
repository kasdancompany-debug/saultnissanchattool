import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { getPublicEnv, isSupabaseConfigured } from "@/lib/env/public";
import type { Database } from "@/types/supabase";

export async function createSupabaseServerClient() {
  if (!isSupabaseConfigured(getPublicEnv())) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY."
    );
  }

  const env = getPublicEnv();
  const cookieStore = await cookies();

  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component; cookie mutation is only valid in Server Actions / Route Handlers.
          }
        },
      },
    }
  );
}
