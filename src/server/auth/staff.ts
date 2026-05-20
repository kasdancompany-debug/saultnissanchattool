import "server-only";

/**
 * Staff session helpers (Supabase Auth → `staff_users`).
 *
 * - **`getCurrentStaffUser()`** — Slim, nullable profile for server code that should work
 *   without a staff row (public routes, optional UI). Returns `null` when there is no session,
 *   no `staff_users` row, inactive staff, or a missing dealership join.
 * - **`getCurrentStaff()`** — Same resolution plus full `staff_users` row and `dealerships` row
 *   for pages that need tenant metadata (timezone, Twilio, etc.).
 * - **`requireStaff()` / `requireStaffUser()`** — Use in protected dashboard routes and server
 *   actions that must have an active staff profile (redirects to `/login` or `/unauthorized`).
 *
 * All session lookups share **`getSession()`** and **`getCurrentStaff()`** (React `cache` per request)
 * so auth is not queried repeatedly within a single RSC tree.
 */
import { cache } from "react";
import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured, publicEnv } from "@/lib/env/public";
import type { TypedSupabaseClient } from "@/server/db/server-client";
import type {
  Database,
  StaffDepartment,
  StaffRole,
} from "@/integrations/supabase/database.types";

export type StaffUserRow = Database["public"]["Tables"]["staff_users"]["Row"];
export type DealershipRow = Database["public"]["Tables"]["dealerships"]["Row"];

/** Active staff profile plus dealership (scoped by `dealership_id` for RLS). */
export type CurrentStaff = StaffUserRow & {
  dealership: DealershipRow;
};

/** Minimal staff context derived from `getCurrentStaff()` (no extra queries). */
export type CurrentStaffUser = {
  id: string;
  dealership_id: string;
  role: StaffRole;
  department: StaffDepartment;
  display_name: string;
};

export const getSession = cache(async (): Promise<{
  user: import("@supabase/supabase-js").User | null;
  supabase: TypedSupabaseClient | null;
}> => {
  if (!isSupabaseConfigured(publicEnv)) {
    return { user: null, supabase: null };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return { user: null, supabase };
  }

  return { user, supabase };
});

/**
 * Resolves the logged-in Supabase Auth user to a `staff_users` row and dealership.
 * Returns null when there is no session or no matching active staff profile.
 */
export const getCurrentStaff = cache(async (): Promise<CurrentStaff | null> => {
  const { user, supabase } = await getSession();
  if (!user || !supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("staff_users")
    .select("*, dealerships (*)")
    .eq("id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const row = data as StaffUserRow & {
    dealerships: DealershipRow | DealershipRow[] | null;
  };

  const rel = row.dealerships;
  const dealership = Array.isArray(rel) ? rel[0] : rel;
  if (!dealership) {
    return null;
  }

  const { dealerships: _drop, ...staff } = row;
  void _drop;

  return { ...staff, dealership };
});

function toCurrentStaffUser(staff: CurrentStaff): CurrentStaffUser {
  return {
    id: staff.id,
    dealership_id: staff.dealership_id,
    role: staff.role,
    department: staff.department,
    display_name: staff.display_name,
  };
}

/**
 * Maps the Supabase Auth user to `staff_users` (no auto-create). Returns null when
 * there is no session, no row, inactive staff, or missing dealership join.
 * Implemented via {@link getCurrentStaff} — no duplicated fetch logic.
 */
export const getCurrentStaffUser = cache(
  async (): Promise<CurrentStaffUser | null> => {
    const staff = await getCurrentStaff();
    return staff ? toCurrentStaffUser(staff) : null;
  }
);

/**
 * Same shape as {@link getCurrentStaffUser} but redirects when unauthenticated or unmapped.
 */
export async function requireStaffUser(): Promise<CurrentStaffUser> {
  const staff = await requireStaff();
  return toCurrentStaffUser(staff);
}

/**
 * Server-side guard for dashboard routes (use in layouts and RSC pages). This is the
 * authoritative check alongside middleware: session + active `staff_users` + dealership join.
 * Wrapped in `cache` so repeated calls in the same request reuse one resolution.
 *
 * - No session → `/login`
 * - Session but no active staff profile → `/unauthorized`
 */
export const requireStaff = cache(async (): Promise<CurrentStaff> => {
  const { user } = await getSession();
  if (!user) {
    redirect("/login");
  }

  const staff = await getCurrentStaff();
  if (!staff) {
    redirect("/unauthorized");
  }

  return staff;
});
