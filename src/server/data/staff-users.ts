import type { Tables } from "@/integrations/supabase/database.types";
import { resolveDb } from "@/server/data/internal";
import {
  fromPostgrestError,
  resultFromNullable,
} from "@/server/data/postgrest-error";
import type { TypedSupabaseClient } from "@/server/db/server-client";
import { ok, type Result } from "@/server/result";

export type StaffUserRow = Tables<"staff_users">;

/**
 * Active staff directory for a dealership (inbox assignment pickers, @mentions, etc.).
 */
export async function listActiveStaffByDealership(
  dealershipId: string,
  options?: { db?: TypedSupabaseClient; limit?: number }
): Promise<Result<StaffUserRow[]>> {
  const supabase = await resolveDb(options?.db);
  const limit = Math.min(options?.limit ?? 200, 1000);

  const res = await supabase
    .from("staff_users")
    .select("*")
    .eq("dealership_id", dealershipId)
    .eq("is_active", true)
    .order("display_name", { ascending: true })
    .limit(limit);

  if (res.error) {
    return fromPostgrestError(res.error);
  }

  return ok(res.data ?? []);
}

/**
 * Full directory for admin settings (includes inactive accounts).
 */
export async function listStaffDirectoryByDealership(
  dealershipId: string,
  options?: { db?: TypedSupabaseClient; limit?: number }
): Promise<Result<StaffUserRow[]>> {
  const supabase = await resolveDb(options?.db);
  const limit = Math.min(options?.limit ?? 300, 1000);

  const res = await supabase
    .from("staff_users")
    .select("*")
    .eq("dealership_id", dealershipId)
    .order("is_active", { ascending: false })
    .order("display_name", { ascending: true })
    .limit(limit);

  if (res.error) {
    return fromPostgrestError(res.error);
  }

  return ok(res.data ?? []);
}

export async function getStaffUserById(
  dealershipId: string,
  staffUserId: string,
  db?: TypedSupabaseClient
): Promise<Result<StaffUserRow>> {
  const supabase = await resolveDb(db);
  const res = await supabase
    .from("staff_users")
    .select("*")
    .eq("dealership_id", dealershipId)
    .eq("id", staffUserId)
    .maybeSingle();

  if (res.error) {
    return fromPostgrestError(res.error);
  }

  return resultFromNullable(res.data, "Staff user not found");
}
