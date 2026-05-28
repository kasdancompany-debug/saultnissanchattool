import { describe, expect, it } from "vitest";

import {
  customerProposedVisit,
  resolveAppointmentReadiness,
} from "@/lib/opportunity/appointment-readiness";
import { computeOpportunityScore } from "@/lib/opportunity/compute-opportunity";

describe("appointment readiness", () => {
  it("detects can i do tomorrow as a proposed visit", () => {
    expect(customerProposedVisit("can i do tomorrow?")).toBe(true);
    const status = resolveAppointmentReadiness({
      customerText: "can i do tomorrow?",
      conversationDepartment: "sales",
      pipelineAppointment: null,
    });
    expect(status.kind).toBe("proposed");
    expect(status.headline.toLowerCase()).toContain("tomorrow");
    expect(status.promptMarkInPipeline).toBe(true);
  });

  it("shows booked when pipeline appointment is marked", () => {
    const status = resolveAppointmentReadiness({
      customerText: "can i do tomorrow?",
      conversationDepartment: "sales",
      pipelineAppointment: {
        at: "2026-05-28T15:00:00.000Z",
        by: "staff-1",
      },
    });
    expect(status.kind).toBe("booked");
    expect(status.headline).toBe("Appointment booked");
    expect(status.promptMarkInPipeline).toBe(false);
  });

  it("boosts inbox list summary for proposed visit", () => {
    const snap = computeOpportunityScore({
      messageText: "My name is Dan\n can i do tomorrow?",
      classification: null,
      conversationMetadata: { widget: { intake_intent: "used_vehicle" } },
      status: "open",
      department: "sales",
    });
    expect(snap.intent_summary.toLowerCase()).toMatch(/visit|confirm/);
    expect(snap.score).toBeGreaterThanOrEqual(80);
  });
});
