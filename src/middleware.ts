import { type NextRequest, NextResponse } from "next/server";

import { isDashboardPathname } from "@/lib/auth/dashboard-paths";
import { isSupabaseConfigured, publicEnv } from "@/lib/env/public";
import { copyCookiesToResponse } from "@/lib/http/copy-middleware-cookies";
import { updateSession } from "@/integrations/supabase/middleware";

async function hasActiveStaffRow(
  supabase: NonNullable<
    Awaited<ReturnType<typeof updateSession>>["supabase"]
  >,
  userId: string
): Promise<boolean> {
  /** `head: true` — existence check only; skips row body over the wire vs `maybeSingle`. */
  const { error, count } = await supabase
    .from("staff_users")
    .select("id", { count: "exact", head: true })
    .eq("id", userId)
    .eq("is_active", true);

  if (error) {
    return false;
  }
  return (count ?? 0) >= 1;
}

export async function middleware(request: NextRequest) {
  if (!isSupabaseConfigured(publicEnv)) {
    return NextResponse.next({ request });
  }

  const { response, user, supabase } = await updateSession(request);
  const { pathname } = request.nextUrl;

  if (pathname === "/unauthorized") {
    return response;
  }

  if (pathname === "/login") {
    if (user && supabase) {
      const okStaff = await hasActiveStaffRow(supabase, user.id);
      if (okStaff) {
        const redirect = NextResponse.redirect(new URL("/overview", request.url));
        copyCookiesToResponse(response, redirect);
        return redirect;
      }
    }
    return response;
  }

  if (isDashboardPathname(pathname)) {
    if (!user) {
      const login = new URL("/login", request.url);
      login.searchParams.set("redirect", pathname);
      const redirect = NextResponse.redirect(login);
      copyCookiesToResponse(response, redirect);
      return redirect;
    }

    if (supabase) {
      const okStaff = await hasActiveStaffRow(supabase, user.id);
      if (!okStaff) {
        const unauthorized = new URL("/unauthorized", request.url);
        const redirect = NextResponse.redirect(unauthorized);
        copyCookiesToResponse(response, redirect);
        return redirect;
      }
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
