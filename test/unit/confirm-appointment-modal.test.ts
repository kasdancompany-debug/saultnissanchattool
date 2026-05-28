import { describe, expect, it } from "vitest";

import { buildAppointmentConfirmedSystemNote } from "@/lib/appointments/confirmed-system-note";
import {
  combineDateAndTimeToIso,
  splitIsoToDateAndTime,
} from "@/lib/appointments/format-datetime";
import { parseConfirmAppointmentFormDates } from "@/components/inbox/confirm-appointment-modal";

describe("confirm appointment modal helpers", () => {
  it("combineDateAndTimeToIso merges date and time", () => {
    const iso = combineDateAndTimeToIso("2026-06-01", "14:30");
    expect(iso).toBeTruthy();
    const split = splitIsoToDateAndTime(iso);
    expect(split.date).toBe("2026-06-01");
    expect(split.time).toBe("14:30");
  });

  it("parseConfirmAppointmentFormDates matches combine", () => {
    expect(parseConfirmAppointmentFormDates("2026-06-01", "09:00")).toBe(
      combineDateAndTimeToIso("2026-06-01", "09:00")
    );
  });

  it("buildAppointmentConfirmedSystemNote includes key details", () => {
    const body = buildAppointmentConfirmedSystemNote({
      department: "sales",
      confirmedDatetimeIso: "2026-06-01T18:00:00.000Z",
      assigneeDisplayName: "Alex",
      vehicleInterest: "2025 Rogue",
      confirmedByDisplayName: "Jordan",
      notes: "Customer prefers afternoon",
    });
    expect(body).toContain("Appointment confirmed");
    expect(body).toContain("Sales");
    expect(body).toContain("Alex");
    expect(body).toContain("2025 Rogue");
    expect(body).toContain("Jordan");
    expect(body).toContain("Customer prefers afternoon");
  });
});
