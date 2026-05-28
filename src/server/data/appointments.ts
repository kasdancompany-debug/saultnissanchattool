/**
 * @deprecated Import from `@/server/appointments` instead.
 * Re-exports preserve compatibility during migration to the appointment service layer.
 */
export {
  confirmAppointment,
  createAppointmentFromConversation as createAppointment,
  getAppointmentsForConversation as listAppointmentsForConversation,
  getAppointmentMetrics,
  getUpcomingAppointments,
} from "@/server/appointments";

export type { CreateAppointmentFromConversationInput as CreateAppointmentInput } from "@/server/appointments/types";

import {
  repositoryGetAppointmentById,
} from "@/server/data/appointments-repository";

/** @deprecated Use service layer or repository directly. */
export const getAppointmentById = repositoryGetAppointmentById;
