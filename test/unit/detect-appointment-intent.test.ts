import { describe, expect, it } from "vitest";

import { detectAppointmentIntent } from "@/lib/opportunity/detect-appointment-intent";
import { resolveAppointmentReadiness } from "@/lib/opportunity/appointment-readiness";

describe("detectAppointmentIntent", () => {
  it.each([
    "can I come in tomorrow",
    "book me in",
    "do you have time",
    "can I test drive the Rogue",
    "schedule service",
    "I need an appointment",
    "what times are available",
  ])("detects phrase: %s", (phrase) => {
    const intent = detectAppointmentIntent({
      customerText: phrase,
      conversationDepartment: "sales",
    });
    expect(intent.show).toBe(true);
    expect(intent.confidence).toBeGreaterThanOrEqual(30);
  });

  it("detects service department for schedule service", () => {
    const intent = detectAppointmentIntent({
      customerText: "Can I schedule service tomorrow morning?",
      conversationDepartment: "general",
    });
    expect(intent.department).toBe("service");
    expect(intent.proposedTimeLabel?.toLowerCase()).toContain("tomorrow");
  });

  it("detects sales department for test drive", () => {
    const intent = detectAppointmentIntent({
      customerText: "can I test drive saturday?",
      conversationDepartment: "general",
    });
    expect(intent.department).toBe("sales");
  });

  it("does not show for unrelated chat", () => {
    const intent = detectAppointmentIntent({
      customerText: "what is your address",
      conversationDepartment: "sales",
    });
    expect(intent.show).toBe(false);
  });
});

describe("resolveAppointmentReadiness intent", () => {
  it("attaches intent insight for tomorrow visit", () => {
    const readiness = resolveAppointmentReadiness({
      customerText: "can i do tomorrow?",
      conversationDepartment: "sales",
      pipelineAppointment: null,
    });
    expect(readiness.kind).toBe("proposed");
    expect(readiness.intent?.show).toBe(true);
    expect(readiness.intent?.confidence).toBeGreaterThan(0);
    expect(readiness.detail).toContain("automatically");
  });
});
