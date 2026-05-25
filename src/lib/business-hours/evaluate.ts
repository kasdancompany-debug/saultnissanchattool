import type { StaffDepartment } from "@/integrations/supabase/database.types";

import type {
  BusinessHoursConfigV1,
  DayWindow,
  LiveHoursEvaluation,
  WeekdayKey,
  WeeklySchedule,
} from "./types";

function departmentScheduleOverride(
  department: StaffDepartment,
  config: BusinessHoursConfigV1
): WeeklySchedule | undefined {
  switch (department) {
    case "sales":
      return config.schedules.sales;
    case "service":
      return config.schedules.service;
    case "parts":
      return config.schedules.parts;
    case "bdc":
      return config.schedules.bdc;
    case "management":
      return config.schedules.management;
    case "general":
      return config.schedules.general;
    default:
      return undefined;
  }
}

const SHORT_WEEKDAY_TO_KEY: Record<string, WeekdayKey> = {
  Mon: "mon",
  Tue: "tue",
  Wed: "wed",
  Thu: "thu",
  Fri: "fri",
  Sat: "sat",
  Sun: "sun",
};

export function getWeekdayKeyInTimezone(date: Date, timeZone: string): WeekdayKey {
  const tz = timeZone?.trim() || "UTC";
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      weekday: "short",
    }).formatToParts(date);
    const w = parts.find((p) => p.type === "weekday")?.value ?? "Mon";
    return SHORT_WEEKDAY_TO_KEY[w] ?? "mon";
  } catch {
    return "mon";
  }
}

function parseHHMM(s: string): number {
  const [h, m] = s.split(":").map(Number);
  return h * 60 + m;
}

function getMinutesSinceMidnightInTimezone(date: Date, timeZone: string): number {
  const tz = timeZone?.trim() || "UTC";
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(date);
  } catch {
    return 0;
  }

  const map: Record<string, string> = {};
  for (const p of parts) {
    if (p.type !== "literal") {
      map[p.type] = p.value;
    }
  }
  let hour = Number.parseInt(map.hour ?? "0", 10);
  const minute = Number.parseInt(map.minute ?? "0", 10);
  // Some locales return hour 24 → normalize
  if (hour === 24) {
    hour = 0;
  }
  return hour * 60 + minute;
}

function isWithinDayWindow(
  day: WeekdayKey,
  schedule: WeeklySchedule,
  minutesSinceMidnight: number
): boolean {
  const window: DayWindow = schedule[day];
  if (window === null) {
    return false;
  }
  const open = parseHHMM(window.open);
  const close = parseHHMM(window.close);
  return minutesSinceMidnight >= open && minutesSinceMidnight < close;
}

/**
 * Picks the weekly schedule for a department: explicit override, else `web_chat`.
 */
export function resolveWeeklyScheduleForDepartment(
  department: StaffDepartment,
  config: BusinessHoursConfigV1
): { schedule: WeeklySchedule; schedule_key: "web_chat" | StaffDepartment } {
  const override = departmentScheduleOverride(department, config);
  if (override) {
    return { schedule: override, schedule_key: department };
  }
  return { schedule: config.schedules.web_chat, schedule_key: "web_chat" };
}

/**
 * Evaluates whether "now" is inside live hours for the given department queue.
 */
export function evaluateLiveHours(
  config: BusinessHoursConfigV1,
  department: StaffDepartment,
  now: Date = new Date()
): LiveHoursEvaluation {
  try {
    const tz = config.timezone?.trim() || "America/Toronto";
    const { schedule, schedule_key } = resolveWeeklyScheduleForDepartment(
      department,
      config
    );
    const day = getWeekdayKeyInTimezone(now, tz);
    const minutes = getMinutesSinceMidnightInTimezone(now, tz);
    const within = isWithinDayWindow(day, schedule, minutes);

    return {
      within_live_hours: within,
      after_hours: !within,
      timezone: tz,
      schedule_key,
      evaluated_at: now.toISOString(),
    };
  } catch {
    return {
      within_live_hours: true,
      after_hours: false,
      timezone: config.timezone?.trim() || "America/Toronto",
      schedule_key: "web_chat",
      evaluated_at: now.toISOString(),
    };
  }
}

/**
 * Short label for display (e.g. "Eastern Time") — best-effort via Intl.
 */
export function formatTimezoneShortLabel(ianaTimezone: string): string {
  const tz = ianaTimezone?.trim();
  if (!tz) return "Local time";
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      timeZoneName: "short",
    }).formatToParts(new Date());
    const name = parts.find((p) => p.type === "timeZoneName")?.value?.trim();
    if (name) return name;
  } catch {
    // invalid IANA or unsupported Intl option
  }
  return tz.replace(/_/g, " ");
}
