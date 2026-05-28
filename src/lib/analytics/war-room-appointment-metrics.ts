import type { AppointmentDepartment, AppointmentStatus } from "@/lib/appointments/types";
import type { AppointmentRow } from "@/lib/appointments/types";

export const COUNTABLE_APPOINTMENT_STATUSES: ReadonlySet<AppointmentStatus> =
  new Set(["confirmed", "completed", "no_show"]);

export type WarRoomAppointmentStaffRow = {
  staffUserId: string;
  displayName: string;
  count: number;
};

export type WarRoomAppointmentMetrics = {
  /** Staff-confirmed records in reporting window (confirmed / completed / no_show). */
  bookedInPeriod: number;
  confirmedToday: number;
  upcomingThisWeek: number;
  noShows: number;
  completed: number;
  conversionRate: number | null;
  conversionRateLabel: string;
  byDepartment: Record<AppointmentDepartment, number>;
  byStaff: WarRoomAppointmentStaffRow[];
};

export function isCountableAppointment(row: Pick<AppointmentRow, "status" | "confirmed_datetime">): boolean {
  return (
    COUNTABLE_APPOINTMENT_STATUSES.has(row.status) &&
    row.confirmed_datetime != null &&
    row.confirmed_datetime.trim().length > 0
  );
}

function parseMs(iso: string): number {
  return new Date(iso).getTime();
}

function isBetween(iso: string, fromMs: number, toMs: number): boolean {
  const t = parseMs(iso);
  return t >= fromMs && t <= toMs;
}

/** Monday 00:00:00.000 UTC for the week containing `now`. */
export function startOfUtcWeek(now: Date): Date {
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
  const day = start.getUTCDay();
  const daysFromMonday = (day + 6) % 7;
  start.setUTCDate(start.getUTCDate() - daysFromMonday);
  return start;
}

/** Sunday 23:59:59.999 UTC for the week containing `now`. */
export function endOfUtcWeek(now: Date): Date {
  const start = startOfUtcWeek(now);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 7);
  end.setUTCMilliseconds(-1);
  return end;
}

export function computeWarRoomAppointmentMetrics(input: {
  rows: AppointmentRow[];
  conversationsStarted: number;
  periodSinceIso: string;
  now: Date;
  staffNamesById: Map<string, string>;
}): WarRoomAppointmentMetrics {
  const nowMs = input.now.getTime();
  const periodFromMs = parseMs(input.periodSinceIso);
  const dayStart = new Date(
    Date.UTC(
      input.now.getUTCFullYear(),
      input.now.getUTCMonth(),
      input.now.getUTCDate()
    )
  );
  const dayEnd = new Date(dayStart);
  dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);
  dayEnd.setUTCMilliseconds(-1);
  const dayStartMs = dayStart.getTime();
  const dayEndMs = dayEnd.getTime();

  const weekEndMs = endOfUtcWeek(input.now).getTime();

  const countable = input.rows.filter(isCountableAppointment);

  let bookedInPeriod = 0;
  let confirmedToday = 0;
  let upcomingThisWeek = 0;
  let noShows = 0;
  let completed = 0;
  const byDepartment: Record<AppointmentDepartment, number> = {
    sales: 0,
    service: 0,
  };
  const staffCounts = new Map<string, number>();
  const conversationsWithBooking = new Set<string>();

  for (const row of countable) {
    const at = row.confirmed_datetime!;
    const atMs = parseMs(at);
    const inPeriod = atMs >= periodFromMs && atMs <= nowMs;

    if (inPeriod) {
      bookedInPeriod += 1;
      byDepartment[row.department] += 1;
      conversationsWithBooking.add(row.conversation_id);

      if (row.booked_by_user_id?.trim()) {
        const id = row.booked_by_user_id.trim();
        staffCounts.set(id, (staffCounts.get(id) ?? 0) + 1);
      }

      if (row.status === "no_show") {
        noShows += 1;
      }
      if (row.status === "completed") {
        completed += 1;
      }
    }

    if (row.status === "confirmed" && isBetween(at, dayStartMs, dayEndMs)) {
      confirmedToday += 1;
    }

    if (
      row.status === "confirmed" &&
      atMs >= nowMs &&
      atMs <= weekEndMs
    ) {
      upcomingThisWeek += 1;
    }
  }

  const conversionRate =
    input.conversationsStarted > 0
      ? Math.round(
          (conversationsWithBooking.size / input.conversationsStarted) * 1000
        ) / 10
      : null;

  const byStaff: WarRoomAppointmentStaffRow[] = [...staffCounts.entries()]
    .map(([staffUserId, count]) => ({
      staffUserId,
      displayName: input.staffNamesById.get(staffUserId) ?? "Staff",
      count,
    }))
    .sort((a, b) => b.count - a.count);

  return {
    bookedInPeriod,
    confirmedToday,
    upcomingThisWeek,
    noShows,
    completed,
    conversionRate,
    conversionRateLabel:
      conversionRate !== null ? `${conversionRate}%` : "—",
    byDepartment,
    byStaff,
  };
}
