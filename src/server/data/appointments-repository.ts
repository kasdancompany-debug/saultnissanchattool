import "server-only";

import type {
  AppointmentDepartment,
  AppointmentStatus,
} from "@/integrations/supabase/database.types";
import type { AppointmentRow } from "@/lib/appointments/types";
import { resolveDb } from "@/server/data/internal";
import {
  fromPostgrestError,
  isMissingSchemaTableError,
} from "@/server/data/postgrest-error";
import type { TypedSupabaseClient } from "@/server/db/server-client";
import { err, ok, type Result } from "@/server/result";
import type { TablesInsert, TablesUpdate } from "@/types/supabase-helpers";

export type AppointmentInsert = TablesInsert<"appointments">;
export type AppointmentUpdate = TablesUpdate<"appointments">;

function emptyOnMissingTable(error: { code?: string; message?: string }): boolean {
  return isMissingSchemaTableError(error as Parameters<typeof isMissingSchemaTableError>[0], "appointments");
}

export async function repositoryInsertAppointment(
  row: AppointmentInsert,
  db?: TypedSupabaseClient
): Promise<Result<AppointmentRow>> {
  const supabase = await resolveDb(db);
  const res = await supabase.from("appointments").insert(row).select("*").single();
  if (res.error) {
    return fromPostgrestError(res.error);
  }
  return ok(res.data as AppointmentRow);
}

export async function repositoryUpdateAppointment(
  dealershipId: string,
  appointmentId: string,
  patch: AppointmentUpdate,
  db?: TypedSupabaseClient
): Promise<Result<AppointmentRow>> {
  const supabase = await resolveDb(db);
  const res = await supabase
    .from("appointments")
    .update(patch)
    .eq("dealership_id", dealershipId)
    .eq("id", appointmentId)
    .select("*")
    .single();

  if (res.error) {
    return fromPostgrestError(res.error);
  }
  return ok(res.data as AppointmentRow);
}

export async function repositoryGetAppointmentById(
  dealershipId: string,
  appointmentId: string,
  db?: TypedSupabaseClient
): Promise<Result<AppointmentRow>> {
  const supabase = await resolveDb(db);
  const res = await supabase
    .from("appointments")
    .select("*")
    .eq("dealership_id", dealershipId)
    .eq("id", appointmentId)
    .maybeSingle();

  if (res.error) {
    return fromPostgrestError(res.error);
  }
  if (!res.data) {
    return err("NOT_FOUND", "Appointment not found");
  }
  return ok(res.data as AppointmentRow);
}

export async function repositoryListAppointmentsForConversation(
  dealershipId: string,
  conversationId: string,
  db?: TypedSupabaseClient
): Promise<Result<AppointmentRow[]>> {
  const supabase = await resolveDb(db);
  const res = await supabase
    .from("appointments")
    .select("*")
    .eq("dealership_id", dealershipId)
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false });

  if (res.error) {
    if (emptyOnMissingTable(res.error)) {
      return ok([]);
    }
    return fromPostgrestError(res.error);
  }
  return ok((res.data ?? []) as AppointmentRow[]);
}

export async function repositoryListUpcomingAppointments(
  dealershipId: string,
  input: {
    nowIso: string;
    limit: number;
    department?: AppointmentDepartment;
  },
  db?: TypedSupabaseClient
): Promise<Result<AppointmentRow[]>> {
  const supabase = await resolveDb(db);
  let query = supabase
    .from("appointments")
    .select("*")
    .eq("dealership_id", dealershipId)
    .eq("status", "confirmed")
    .gte("confirmed_datetime", input.nowIso)
    .order("confirmed_datetime", { ascending: true })
    .limit(input.limit);

  if (input.department) {
    query = query.eq("department", input.department);
  }

  const res = await query;
  if (res.error) {
    if (emptyOnMissingTable(res.error)) {
      return ok([]);
    }
    return fromPostgrestError(res.error);
  }
  return ok((res.data ?? []) as AppointmentRow[]);
}

/** Rows created or confirmed within the reporting window (deduped by id). */
export async function repositoryListAppointmentsForMetrics(
  dealershipId: string,
  period: { from: string; to: string },
  db?: TypedSupabaseClient
): Promise<Result<AppointmentRow[]>> {
  const supabase = await resolveDb(db);

  const [byCreated, byConfirmed] = await Promise.all([
    supabase
      .from("appointments")
      .select("*")
      .eq("dealership_id", dealershipId)
      .gte("created_at", period.from)
      .lte("created_at", period.to),
    supabase
      .from("appointments")
      .select("*")
      .eq("dealership_id", dealershipId)
      .not("confirmed_datetime", "is", null)
      .gte("confirmed_datetime", period.from)
      .lte("confirmed_datetime", period.to),
  ]);

  if (byCreated.error) {
    if (emptyOnMissingTable(byCreated.error)) {
      return ok([]);
    }
    return fromPostgrestError(byCreated.error);
  }
  if (byConfirmed.error) {
    if (emptyOnMissingTable(byConfirmed.error)) {
      return ok([]);
    }
    return fromPostgrestError(byConfirmed.error);
  }

  const merged = new Map<string, AppointmentRow>();
  for (const row of [...(byCreated.data ?? []), ...(byConfirmed.data ?? [])]) {
    merged.set(row.id, row as AppointmentRow);
  }
  return ok([...merged.values()]);
}

/** Staff-confirmed lifecycle rows only (not proposed / AI intent). */
export async function repositoryListCountableAppointments(
  dealershipId: string,
  input: { confirmedFrom: string; confirmedTo: string },
  db?: TypedSupabaseClient
): Promise<Result<AppointmentRow[]>> {
  const supabase = await resolveDb(db);
  const res = await supabase
    .from("appointments")
    .select("*")
    .eq("dealership_id", dealershipId)
    .in("status", ["confirmed", "completed", "no_show"])
    .not("confirmed_datetime", "is", null)
    .gte("confirmed_datetime", input.confirmedFrom)
    .lte("confirmed_datetime", input.confirmedTo)
    .order("confirmed_datetime", { ascending: false })
    .limit(10000);

  if (res.error) {
    if (emptyOnMissingTable(res.error)) {
      return ok([]);
    }
    return fromPostgrestError(res.error);
  }
  return ok((res.data ?? []) as AppointmentRow[]);
}

export async function repositoryCountUpcomingAppointments(
  dealershipId: string,
  nowIso: string,
  db?: TypedSupabaseClient
): Promise<Result<number>> {
  const supabase = await resolveDb(db);
  const res = await supabase
    .from("appointments")
    .select("id", { count: "exact", head: true })
    .eq("dealership_id", dealershipId)
    .eq("status", "confirmed")
    .gte("confirmed_datetime", nowIso);

  if (res.error) {
    if (emptyOnMissingTable(res.error)) {
      return ok(0);
    }
    return fromPostgrestError(res.error);
  }
  return ok(res.count ?? 0);
}

export function repositoryNormalizeOptionalText(
  value: string | null | undefined
): string | null {
  if (value == null) {
    return null;
  }
  const t = value.trim();
  return t.length > 0 ? t : null;
}

export function repositoryRequiresConfirmedDatetime(
  status: AppointmentStatus
): boolean {
  return status === "confirmed" || status === "completed";
}
