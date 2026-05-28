import { describe, expect, it } from "vitest";

import {
  isActiveAppointmentStatus,
  pickPrimaryAppointment,
} from "@/lib/appointments/types";
import { shouldSyncPipelineOnAppointmentStatus } from "@/lib/appointments/pipeline-bridge";
import { resolveAppointmentReadiness } from "@/lib/opportunity/appointment-readiness";
import type { AppointmentRow } from "@/lib/appointments/types";

function row(
  partial: Partial<AppointmentRow> & Pick<AppointmentRow, "status" | "created_at">
): AppointmentRow {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    dealership_id: "00000000-0000-4000-8000-000000000002",
    conversation_id: "00000000-0000-4000-8000-000000000003",
    customer_id: null,
    department: "sales",
    proposed_datetime: null,
    confirmed_datetime: null,
    assigned_user_id: null,
    booked_by_user_id: null,
    vehicle_interest: null,
    notes: null,
    source: "manual",
    updated_at: partial.created_at,
    ...partial,
  };
}

describe("appointments", () => {
  it("pickPrimaryAppointment prefers active rows", () => {
    const cancelled = row({
      status: "cancelled",
      created_at: "2026-05-28T18:00:00.000Z",
    });
    const proposed = row({
      status: "proposed",
      created_at: "2026-05-28T12:00:00.000Z",
    });
    expect(pickPrimaryAppointment([cancelled, proposed])?.status).toBe("proposed");
  });

  it("shouldSyncPipelineOnAppointmentStatus only for confirmed/completed", () => {
    expect(shouldSyncPipelineOnAppointmentStatus("confirmed")).toBe(true);
    expect(shouldSyncPipelineOnAppointmentStatus("completed")).toBe(true);
    expect(shouldSyncPipelineOnAppointmentStatus("proposed")).toBe(false);
    expect(shouldSyncPipelineOnAppointmentStatus("cancelled")).toBe(false);
  });

  it("resolveAppointmentReadiness uses pipeline stamp before appointment rows", () => {
    const readiness = resolveAppointmentReadiness({
      customerText: "can i come tomorrow",
      conversationDepartment: "sales",
      pipelineAppointment: { at: "2026-05-28T10:00:00.000Z", by: "staff-1" },
      conversationAppointments: [
        row({
          status: "proposed",
          created_at: "2026-05-28T11:00:00.000Z",
          proposed_datetime: "2026-05-29T15:00:00.000Z",
        }),
      ],
    });
    expect(readiness.kind).toBe("booked");
    expect(readiness.detail).toContain("pipeline");
  });

  it("resolveAppointmentReadiness shows confirmed row when no pipeline stamp", () => {
    const readiness = resolveAppointmentReadiness({
      customerText: "",
      conversationDepartment: "sales",
      pipelineAppointment: undefined,
      conversationAppointments: [
        row({
          status: "confirmed",
          created_at: "2026-05-28T11:00:00.000Z",
          confirmed_datetime: "2026-05-29T15:00:00.000Z",
        }),
      ],
    });
    expect(readiness.kind).toBe("booked");
    expect(readiness.headline).toBe("Appointment confirmed");
  });

  it("isActiveAppointmentStatus excludes terminal states", () => {
    expect(isActiveAppointmentStatus("confirmed")).toBe(true);
    expect(isActiveAppointmentStatus("cancelled")).toBe(false);
  });
});
