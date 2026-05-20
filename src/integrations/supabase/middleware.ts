import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";

import { getPublicEnv, isSupabaseConfigured } from "@/lib/env/public";
import type { Database } from "@/types/supabase";

export type SupabaseMiddlewareClient = SupabaseClient<Database>;

export async function updateSession(
  request: NextRequest
): Promise<{
  response: NextResponse;
  user: User | null;
  supabase: SupabaseMiddlewareClient | null;
}> {
  if (!isSupabaseConfigured(getPublicEnv())) {
    return {
      response: NextResponse.next({ request }),
      user: null,
      supabase: null,
    };
  }

  const env = getPublicEnv();
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { response: supabaseResponse, user, supabase };
}
