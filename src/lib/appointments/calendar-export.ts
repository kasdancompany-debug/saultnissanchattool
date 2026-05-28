import {
  APPOINTMENT_DEPARTMENT_LABEL,
  type AppointmentDepartment,
  type AppointmentRow,
} from "@/lib/appointments/types";
import { formatAppointmentDisplay } from "@/lib/appointments/format-datetime";

/** Default visit block when no explicit end time exists. */
const DEFAULT_DURATION_MS = 60 * 60 * 1000;

export type AppointmentCalendarExportContext = {
  appointment: Pick<
    AppointmentRow,
    | "id"
    | "department"
    | "confirmed_datetime"
    | "vehicle_interest"
    | "notes"
    | "conversation_id"
  >;
  customerName: string;
  customerEmail?: string | null;
  customerPhoneE164?: string | null;
  /** Site origin without trailing slash, e.g. https://app.example.com */
  appOrigin?: string | null;
};

export function buildInboxConversationUrl(
  conversationId: string,
  appOrigin?: string | null
): string | null {
  const base = appOrigin?.trim().replace(/\/$/, "") ?? "";
  if (!base || !conversationId.trim()) {
    return null;
  }
  return `${base}/inbox?filter=all_open&c=${encodeURIComponent(conversationId.trim())}`;
}

function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\n|\r/g, "\\n");
}

function foldIcsLine(line: string): string {
  const max = 75;
  if (line.length <= max) {
    return line;
  }
  const parts: string[] = [];
  let rest = line;
  parts.push(rest.slice(0, max));
  rest = rest.slice(max);
  while (rest.length > 0) {
    parts.push(` ${rest.slice(0, max - 1)}`);
    rest = rest.slice(max - 1);
  }
  return parts.join("\r\n");
}

function toIcsUtcDateTime(iso: string): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return null;
  }
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

function departmentLabel(department: AppointmentDepartment): string {
  return APPOINTMENT_DEPARTMENT_LABEL[department] ?? department;
}

function buildDescriptionLines(ctx: AppointmentCalendarExportContext): string[] {
  const { appointment, customerName } = ctx;
  const lines: string[] = [
    `Customer: ${customerName.trim() || "Customer"}`,
    `Department: ${departmentLabel(appointment.department)}`,
  ];

  const vehicle = appointment.vehicle_interest?.trim();
  if (vehicle) {
    lines.push(`Vehicle interest: ${vehicle}`);
  }

  const phone = ctx.customerPhoneE164?.trim();
  if (phone) {
    lines.push(`Phone: ${phone}`);
  }

  const email = ctx.customerEmail?.trim();
  if (email) {
    lines.push(`Email: ${email}`);
  }

  const conversationUrl = buildInboxConversationUrl(
    appointment.conversation_id,
    ctx.appOrigin
  );
  if (conversationUrl) {
    lines.push(`Conversation: ${conversationUrl}`);
  }

  const notes = appointment.notes?.trim();
  if (notes) {
    lines.push(`Notes: ${notes}`);
  }

  return lines;
}

export function buildAppointmentCalendarSummary(
  ctx: AppointmentCalendarExportContext
): string | null {
  const confirmedAt = ctx.appointment.confirmed_datetime?.trim();
  if (!confirmedAt) {
    return null;
  }

  const when = formatAppointmentDisplay(confirmedAt);
  if (!when) {
    return null;
  }

  const name = ctx.customerName.trim() || "Customer";
  const dept = departmentLabel(ctx.appointment.department);
  const lines: string[] = [
    `${dept} appointment — ${name}`,
    `When: ${when}`,
  ];

  const vehicle = ctx.appointment.vehicle_interest?.trim();
  if (vehicle) {
    lines.push(`Vehicle: ${vehicle}`);
  }

  const phone = ctx.customerPhoneE164?.trim();
  if (phone) {
    lines.push(`Phone: ${phone}`);
  }

  const email = ctx.customerEmail?.trim();
  if (email) {
    lines.push(`Email: ${email}`);
  }

  const conversationUrl = buildInboxConversationUrl(
    ctx.appointment.conversation_id,
    ctx.appOrigin
  );
  if (conversationUrl) {
    lines.push(`Thread: ${conversationUrl}`);
  }

  const notes = ctx.appointment.notes?.trim();
  if (notes) {
    lines.push(`Notes: ${notes}`);
  }

  return lines.join("\n");
}

export function buildAppointmentIcsContent(
  ctx: AppointmentCalendarExportContext
): string | null {
  const startIso = ctx.appointment.confirmed_datetime?.trim();
  if (!startIso) {
    return null;
  }

  const start = new Date(startIso);
  if (Number.isNaN(start.getTime())) {
    return null;
  }

  const dtStart = toIcsUtcDateTime(startIso);
  const dtEnd = toIcsUtcDateTime(
    new Date(start.getTime() + DEFAULT_DURATION_MS).toISOString()
  );
  const dtStamp = toIcsUtcDateTime(new Date().toISOString());
  if (!dtStart || !dtEnd || !dtStamp) {
    return null;
  }

  const customerName = ctx.customerName.trim() || "Customer";
  const dept = departmentLabel(ctx.appointment.department);
  const summary = `${dept} appointment — ${customerName}`;
  const description = escapeIcsText(buildDescriptionLines(ctx).join("\n"));
  const uid = `appointment-${ctx.appointment.id}@sault-nissan-chat`;

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Sault Nissan Chat Tool//Appointment Export//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    foldIcsLine(`SUMMARY:${escapeIcsText(summary)}`),
    foldIcsLine(`DESCRIPTION:${description}`),
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  return `${lines.join("\r\n")}\r\n`;
}

export function buildAppointmentIcsFilename(
  ctx: AppointmentCalendarExportContext
): string {
  const name = (ctx.customerName.trim() || "appointment")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  const datePart = ctx.appointment.confirmed_datetime
    ? new Date(ctx.appointment.confirmed_datetime).toISOString().slice(0, 10)
    : "visit";
  return `${name || "appointment"}-${datePart}.ics`;
}

export function canExportAppointmentCalendar(
  appointment: Pick<AppointmentRow, "status" | "confirmed_datetime">
): boolean {
  return (
    appointment.status === "confirmed" &&
    Boolean(appointment.confirmed_datetime?.trim())
  );
}
