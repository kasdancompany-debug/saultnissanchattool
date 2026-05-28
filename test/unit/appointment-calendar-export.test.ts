import { describe, expect, it } from "vitest";

import {
  buildAppointmentCalendarSummary,
  buildAppointmentIcsContent,
  buildAppointmentIcsFilename,
  buildInboxConversationUrl,
  canExportAppointmentCalendar,
} from "@/lib/appointments/calendar-export";
import type { AppointmentRow } from "@/lib/appointments/types";

const baseAppointment = {
  id: "apt-1",
  department: "sales",
  confirmed_datetime: "2026-06-15T18:30:00.000Z",
  vehicle_interest: "2024 Rogue SV",
  notes: "Customer wants trade appraisal.",
  conversation_id: "conv-abc",
  status: "confirmed",
} as Pick<
  AppointmentRow,
  | "id"
  | "department"
  | "confirmed_datetime"
  | "vehicle_interest"
  | "notes"
  | "conversation_id"
  | "status"
>;

describe("appointment calendar export", () => {
  it("allows export only for confirmed rows with datetime", () => {
    expect(canExportAppointmentCalendar(baseAppointment)).toBe(true);
    expect(
      canExportAppointmentCalendar({
        ...baseAppointment,
        status: "proposed",
      })
    ).toBe(false);
    expect(
      canExportAppointmentCalendar({
        ...baseAppointment,
        confirmed_datetime: null,
      })
    ).toBe(false);
  });

  it("builds inbox conversation deep link", () => {
    expect(buildInboxConversationUrl("conv-abc", "https://app.example.com")).toBe(
      "https://app.example.com/inbox?filter=all_open&c=conv-abc"
    );
  });

  it("includes customer, department, vehicle, contact, thread, and notes in summary", () => {
    const summary = buildAppointmentCalendarSummary({
      appointment: baseAppointment,
      customerName: "Jordan Lee",
      customerEmail: "jordan@example.com",
      customerPhoneE164: "+17055550100",
      appOrigin: "https://app.example.com",
    });
    expect(summary).toContain("Sales appointment — Jordan Lee");
    expect(summary).toContain("2024 Rogue SV");
    expect(summary).toContain("+17055550100");
    expect(summary).toContain("jordan@example.com");
    expect(summary).toContain("/inbox?filter=all_open&c=conv-abc");
    expect(summary).toContain("trade appraisal");
  });

  it("generates valid ICS with core fields", () => {
    const ics = buildAppointmentIcsContent({
      appointment: baseAppointment,
      customerName: "Jordan Lee",
      customerPhoneE164: "+17055550100",
      appOrigin: "https://app.example.com",
    });
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("DTSTART:");
    expect(ics).toContain("DTEND:");
    expect(ics).toContain("SUMMARY:Sales appointment — Jordan Lee");
    expect(ics).not.toBeNull();
    const icsFlat = ics!.replace(/\r?\n\s?/g, "");
    expect(icsFlat).toContain("Vehicle interest: 2024 Rogue SV");
    expect(icsFlat).toContain("Phone: +17055550100");
    expect(icsFlat).toContain(
      "Conversation: https://app.example.com/inbox?filter=all_open&c=conv-abc"
    );
    expect(ics).toContain("END:VEVENT");
  });

  it("sanitizes download filename", () => {
    const name = buildAppointmentIcsFilename({
      appointment: baseAppointment,
      customerName: "Jordan Lee!!!",
    });
    expect(name).toMatch(/^jordan-lee-/);
    expect(name.endsWith(".ics")).toBe(true);
  });
});
