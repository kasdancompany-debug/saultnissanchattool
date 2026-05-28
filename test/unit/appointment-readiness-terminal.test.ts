import { describe, expect, it } from "vitest";

import { resolveAppointmentReadiness } from "@/lib/opportunity/appointment-readiness";
import type { AppointmentRow } from "@/lib/appointments/types";

function appointment(
  partial: Partial<AppointmentRow> & Pick<AppointmentRow, "status">
): AppointmentRow {
  const { status, ...rest } = partial;
  return {
    id: "apt-1",
    dealership_id: "d1",
    conversation_id: "c1",
    customer_id: null,
    department: "sales",
    proposed_datetime: null,
    confirmed_datetime: "2026-06-02T15:00:00.000Z",
    assigned_user_id: null,
    booked_by_user_id: null,
    vehicle_interest: null,
    notes: null,
    source: "manual",
    created_at: "2026-06-01T12:00:00.000Z",
    updated_at: "2026-06-01T12:00:00.000Z",
    status,
    ...rest,
  };
}

describe("appointment readiness terminal states", () => {
  it("surfaces cancelled without re-showing intent", () => {
    const readiness = resolveAppointmentReadiness({
      customerText: "Can I book for tomorrow?",
      conversationDepartment: "sales",
      pipelineAppointment: null,
      conversationAppointments: [appointment({ status: "cancelled" })],
    });
    expect(readiness.headline).toBe("Appointment cancelled");
    expect(readiness.intent).toBeNull();
  });

  it("surfaces no-show clearly", () => {
    const readiness = resolveAppointmentReadiness({
      customerText: "",
      conversationDepartment: "service",
      pipelineAppointment: null,
      conversationAppointments: [appointment({ status: "no_show", department: "service" })],
    });
    expect(readiness.headline).toBe("No-show recorded");
    expect(readiness.intent).toBeNull();
  });
});
