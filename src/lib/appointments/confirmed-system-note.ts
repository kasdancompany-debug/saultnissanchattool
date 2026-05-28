import type { AppointmentDepartment } from "@/integrations/supabase/database.types";
import { APPOINTMENT_DEPARTMENT_LABEL } from "@/lib/appointments/types";
import { formatAppointmentDisplay } from "@/lib/appointments/format-datetime";

export function buildAppointmentConfirmedSystemNote(input: {
  department: AppointmentDepartment;
  confirmedDatetimeIso: string;
  assigneeDisplayName?: string | null;
  vehicleInterest?: string | null;
  confirmedByDisplayName: string;
  notes?: string | null;
}): string {
  const when =
    formatAppointmentDisplay(input.confirmedDatetimeIso) ?? "scheduled time";
  const dept = APPOINTMENT_DEPARTMENT_LABEL[input.department];
  const parts = [
    `Appointment confirmed — ${dept} visit on ${when}.`,
  ];
  if (input.assigneeDisplayName?.trim()) {
    parts.push(`Assigned to ${input.assigneeDisplayName.trim()}.`);
  }
  if (input.vehicleInterest?.trim()) {
    parts.push(`Interest: ${input.vehicleInterest.trim()}.`);
  }
  if (input.notes?.trim()) {
    parts.push(`Notes: ${input.notes.trim()}`);
  }
  parts.push(`Confirmed by ${input.confirmedByDisplayName.trim()}.`);
  return parts.join(" ");
}
