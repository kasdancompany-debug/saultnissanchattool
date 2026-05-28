import { describe, expect, it } from "vitest";

import {
  computeWarRoomAppointmentMetrics,
  isCountableAppointment,
} from "@/lib/analytics/war-room-appointment-metrics";
import type { AppointmentRow } from "@/lib/appointments/types";

const now = new Date("2026-05-28T15:00:00.000Z");
const periodSince = "2026-05-01T00:00:00.000Z";

function row(
  partial: Partial<AppointmentRow> & Pick<AppointmentRow, "status" | "confirmed_datetime">
): AppointmentRow {
  const { status, confirmed_datetime, ...rest } = partial;
  return {
    id: "00000000-0000-4000-8000-000000000099",
    dealership_id: "d1",
    conversation_id: "c1",
    customer_id: null,
    department: "sales",
    proposed_datetime: null,
    assigned_user_id: null,
    booked_by_user_id: null,
    vehicle_interest: null,
    notes: null,
    source: "manual",
    created_at: "2026-05-01T00:00:00.000Z",
    updated_at: "2026-05-01T00:00:00.000Z",
    status,
    confirmed_datetime,
    ...rest,
  };
}

describe("war-room appointment metrics", () => {
  it("ignores proposed status", () => {
    expect(
      isCountableAppointment({
        status: "proposed",
        confirmed_datetime: "2026-05-28T10:00:00.000Z",
      })
    ).toBe(false);
  });

  it("counts confirmed, completed, and no_show", () => {
    const metrics = computeWarRoomAppointmentMetrics({
      rows: [
        row({
          id: "a1",
          status: "confirmed",
          confirmed_datetime: "2026-05-28T10:00:00.000Z",
          conversation_id: "c1",
          booked_by_user_id: "staff-1",
        }),
        row({
          id: "a2",
          status: "completed",
          confirmed_datetime: "2026-05-10T14:00:00.000Z",
          conversation_id: "c2",
          department: "service",
        }),
        row({
          id: "a3",
          status: "no_show",
          confirmed_datetime: "2026-05-12T14:00:00.000Z",
          conversation_id: "c3",
        }),
        row({
          id: "a4",
          status: "proposed",
          confirmed_datetime: "2026-05-28T11:00:00.000Z",
        }),
      ],
      conversationsStarted: 10,
      periodSinceIso: periodSince,
      now,
      staffNamesById: new Map([["staff-1", "Alex"]]),
    });

    expect(metrics.bookedInPeriod).toBe(3);
    expect(metrics.confirmedToday).toBe(1);
    expect(metrics.completed).toBe(1);
    expect(metrics.noShows).toBe(1);
    expect(metrics.byDepartment.sales).toBe(2);
    expect(metrics.byDepartment.service).toBe(1);
    expect(metrics.conversionRate).toBe(30);
    expect(metrics.byStaff[0]?.displayName).toBe("Alex");
  });

  it("counts upcoming confirmed this week", () => {
    const metrics = computeWarRoomAppointmentMetrics({
      rows: [
        row({
          status: "confirmed",
          confirmed_datetime: "2026-05-30T10:00:00.000Z",
        }),
      ],
      conversationsStarted: 1,
      periodSinceIso: periodSince,
      now,
      staffNamesById: new Map(),
    });
    expect(metrics.upcomingThisWeek).toBe(1);
  });
});
