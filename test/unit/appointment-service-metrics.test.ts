import { describe, expect, it } from "vitest";

import { computeAppointmentMetrics } from "@/server/appointments/appointment-metrics";
import type { AppointmentRow } from "@/lib/appointments/types";

const period = {
  from: "2026-05-01T00:00:00.000Z",
  to: "2026-05-31T23:59:59.999Z",
};

function row(
  partial: Partial<AppointmentRow> & Pick<AppointmentRow, "status" | "created_at">
): AppointmentRow {
  return {
    id: partial.id ?? "00000000-0000-4000-8000-000000000099",
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

describe("computeAppointmentMetrics", () => {
  it("counts statuses in period and upcoming separately", () => {
    const metrics = computeAppointmentMetrics({
      period,
      upcoming: 2,
      nowIso: "2026-05-15T12:00:00.000Z",
      rows: [
        row({
          status: "proposed",
          created_at: "2026-05-10T10:00:00.000Z",
        }),
        row({
          status: "confirmed",
          created_at: "2026-05-12T10:00:00.000Z",
          confirmed_datetime: "2026-05-20T15:00:00.000Z",
        }),
        row({
          status: "no_show",
          created_at: "2026-04-01T10:00:00.000Z",
          confirmed_datetime: "2026-05-18T15:00:00.000Z",
        }),
      ],
    });

    expect(metrics.counts.proposed).toBe(1);
    expect(metrics.counts.confirmed).toBe(1);
    expect(metrics.counts.noShow).toBe(1);
    expect(metrics.upcoming).toBe(2);
    expect(metrics.byDepartment.sales.confirmed).toBe(1);
    expect(metrics.byDepartment.sales.noShow).toBe(1);
  });
});
