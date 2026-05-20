import type { StaffDepartment } from "@/integrations/supabase/database.types";

/** Lowercase keys, Mon–Sun. */
export type WeekdayKey =
  | "mon"
  | "tue"
  | "wed"
  | "thu"
  | "fri"
  | "sat"
  | "sun";

/** `null` = closed that day. */
export type DayWindow = { open: string; close: string } | null;

export type WeeklySchedule = Record<WeekdayKey, DayWindow>;

export type DepartmentScheduleKey = Extract<
  StaffDepartment,
  "sales" | "service" | "parts" | "bdc" | "management" | "general"
>;

/**
 * V1 business hours document stored in `dealerships.business_hours`.
 * `schedules.web_chat` is the primary web widget schedule; optional per-department
 * entries override for that queue when we route by department (future / advanced).
 */
export type BusinessHoursConfigV1 = {
  version: 1;
  /** IANA timezone used when evaluating open/closed. */
  timezone: string;
  schedules: {
    web_chat: WeeklySchedule;
  } & Partial<Record<DepartmentScheduleKey, WeeklySchedule>>;
};

export type LiveHoursEvaluation = {
  /** True when current local time in `timezone` falls inside the resolved day window. */
  within_live_hours: boolean;
  /** True when outside live hours (inverse of within_live_hours). */
  after_hours: boolean;
  /** IANA timezone used for the evaluation. */
  timezone: string;
  /** Which schedule was applied (e.g. web_chat vs sales). */
  schedule_key: "web_chat" | DepartmentScheduleKey;
  /** ISO timestamp (UTC) when evaluation ran. */
  evaluated_at: string;
};
