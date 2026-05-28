import type { AppointmentRow } from "@/lib/appointments/types";
import type { AppointmentMetrics, AppointmentMetricsPeriod } from "@/server/appointments/types";

function emptyDepartmentCounts(): AppointmentMetrics["byDepartment"] {
  return {
    sales: { confirmed: 0, completed: 0, noShow: 0 },
    service: { confirmed: 0, completed: 0, noShow: 0 },
  };
}

function inPeriod(iso: string | null, period: AppointmentMetricsPeriod): boolean {
  if (!iso) {
    return false;
  }
  const t = new Date(iso).getTime();
  return (
    t >= new Date(period.from).getTime() && t <= new Date(period.to).getTime()
  );
}

export function computeAppointmentMetrics(input: {
  period: AppointmentMetricsPeriod;
  rows: AppointmentRow[];
  upcoming: number;
  nowIso: string;
}): AppointmentMetrics {
  const counts = {
    proposed: 0,
    awaitingConfirmation: 0,
    confirmed: 0,
    completed: 0,
    noShow: 0,
    cancelled: 0,
  };
  const byDepartment = emptyDepartmentCounts();

  for (const row of input.rows) {
    const inCreatedWindow = inPeriod(row.created_at, input.period);
    const inConfirmedWindow = inPeriod(row.confirmed_datetime, input.period);

    if (!inCreatedWindow && !inConfirmedWindow) {
      continue;
    }

    switch (row.status) {
      case "proposed":
        if (inCreatedWindow) counts.proposed += 1;
        break;
      case "awaiting_confirmation":
        if (inCreatedWindow) counts.awaitingConfirmation += 1;
        break;
      case "confirmed":
        if (inCreatedWindow || inConfirmedWindow) counts.confirmed += 1;
        if (inConfirmedWindow) {
          byDepartment[row.department].confirmed += 1;
        }
        break;
      case "completed":
        if (inCreatedWindow || inConfirmedWindow) counts.completed += 1;
        if (inConfirmedWindow) {
          byDepartment[row.department].completed += 1;
        }
        break;
      case "no_show":
        if (inCreatedWindow || inConfirmedWindow) counts.noShow += 1;
        if (inConfirmedWindow) {
          byDepartment[row.department].noShow += 1;
        }
        break;
      case "cancelled":
        if (inCreatedWindow) counts.cancelled += 1;
        break;
      default:
        break;
    }
  }

  return {
    period: input.period,
    counts,
    upcoming: input.upcoming,
    byDepartment,
  };
}

export function countUpcomingFromRows(
  rows: AppointmentRow[],
  nowIso: string
): number {
  const now = new Date(nowIso).getTime();
  return rows.filter(
    (r) =>
      r.status === "confirmed" &&
      r.confirmed_datetime != null &&
      new Date(r.confirmed_datetime).getTime() >= now
  ).length;
}
