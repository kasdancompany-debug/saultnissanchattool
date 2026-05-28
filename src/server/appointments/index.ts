export {
  cancelAppointment,
  confirmAppointment,
  createAppointmentFromConversation,
  getAppointmentMetrics,
  getAppointmentsForConversation,
  getUpcomingAppointments,
  markAppointmentCompleted,
  markNoShow,
  saveConfirmedAppointmentFromConversation,
  updateAppointmentDetails,
  updateAppointmentStatus,
} from "@/server/appointments/appointment-service";

export type {
  AppointmentMetrics,
  AppointmentMetricsPeriod,
  AppointmentRow,
  CreateAppointmentFromConversationInput,
  GetUpcomingAppointmentsOptions,
} from "@/server/appointments/types";

export { trySyncConversationPipelineAppointment } from "@/server/appointments/sync-conversation-pipeline";
