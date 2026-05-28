import type { AppointmentStatus } from "@/lib/appointments/types";

/**
 * Whether confirming an appointment row should also set `metadata.pipeline.appointment`.
 * War room metrics still read pipeline only; this keeps one explicit staff confirmation path.
 */
export function shouldSyncPipelineOnAppointmentStatus(
  status: AppointmentStatus
): boolean {
  return status === "confirmed" || status === "completed";
}
