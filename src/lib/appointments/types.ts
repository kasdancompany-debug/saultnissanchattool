import type {
  AppointmentDepartment,
  AppointmentSource,
  AppointmentStatus,
} from "@/integrations/supabase/database.types";
import type { Tables } from "@/types/supabase-helpers";

export type {
  AppointmentDepartment,
  AppointmentSource,
  AppointmentStatus,
};

export type AppointmentRow = Tables<"appointments">;

export const APPOINTMENT_STATUS_LABEL: Record<AppointmentStatus, string> = {
  proposed: "Proposed",
  awaiting_confirmation: "Awaiting confirmation",
  confirmed: "Confirmed",
  completed: "Completed",
  no_show: "No show",
  cancelled: "Cancelled",
};

export const APPOINTMENT_DEPARTMENT_LABEL: Record<AppointmentDepartment, string> = {
  sales: "Sales",
  service: "Service",
};

export const APPOINTMENT_SOURCE_LABEL: Record<AppointmentSource, string> = {
  ai_detected: "AI detected",
  manual: "Manual",
  quick_action: "Quick action",
};

export const TERMINAL_APPOINTMENT_STATUSES: ReadonlySet<AppointmentStatus> =
  new Set(["completed", "no_show", "cancelled"]);

export function isActiveAppointmentStatus(
  status: AppointmentStatus
): boolean {
  return !TERMINAL_APPOINTMENT_STATUSES.has(status);
}

export function pickPrimaryAppointment(
  rows: AppointmentRow[]
): AppointmentRow | null {
  if (rows.length === 0) {
    return null;
  }
  const active = rows.filter((r) => isActiveAppointmentStatus(r.status));
  const pool = active.length > 0 ? active : rows;
  return [...pool].sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )[0] ?? null;
}
