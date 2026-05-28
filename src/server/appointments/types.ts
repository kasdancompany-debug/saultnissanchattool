import type {
  AppointmentDepartment,
  AppointmentSource,
  AppointmentStatus,
} from "@/integrations/supabase/database.types";
import type { AppointmentRow } from "@/lib/appointments/types";

export type { AppointmentRow };

export type CreateAppointmentFromConversationInput = {
  dealershipId: string;
  conversationId: string;
  actorUserId: string;
  department?: AppointmentDepartment;
  status?: AppointmentStatus;
  proposedDatetime?: string | null;
  confirmedDatetime?: string | null;
  assignedUserId?: string | null;
  vehicleInterest?: string | null;
  notes?: string | null;
  source?: AppointmentSource;
  /** Best-effort pipeline stamp when status is confirmed/completed. Default true. */
  syncPipeline?: boolean;
};

export type AppointmentMetricsPeriod = {
  from: string;
  to: string;
};

export type AppointmentMetrics = {
  period: AppointmentMetricsPeriod;
  counts: {
    proposed: number;
    awaitingConfirmation: number;
    confirmed: number;
    completed: number;
    noShow: number;
    cancelled: number;
  };
  /** Confirmed visits with `confirmed_datetime` in the future. */
  upcoming: number;
  byDepartment: Record<
    AppointmentDepartment,
    {
      confirmed: number;
      completed: number;
      noShow: number;
    }
  >;
};

export type GetUpcomingAppointmentsOptions = {
  limit?: number;
  department?: AppointmentDepartment;
  now?: string;
};
