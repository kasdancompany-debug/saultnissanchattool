import { describe, expect, it } from "vitest";

import { computeExecutiveOverviewMetrics } from "@/lib/analytics/executive-metrics";

const baseRow = {
  id: "c1",
  channel: "web_chat" as const,
  status: "open" as const,
  department: "sales",
  title: "Web chat — book appointment",
  created_at: "2026-05-01T12:00:00.000Z",
};

describe("computeExecutiveOverviewMetrics", () => {
  it("does not count appointments from booking keywords or AI signals", () => {
    const metrics = computeExecutiveOverviewMetrics({
      periodRows: [
        {
          ...baseRow,
          metadata: {
            widget: { intake_intent: "service" },
            opportunity: {
              score: 85,
              intent_summary: "Wants appointment",
              confidence_pct: 90,
              signals: [{ id: "appointment", label: "Appointment", active: true }],
            },
            lead_capture: { intent: "book_appointment" },
          },
        },
      ],
      openRows: [],
      conversationsStarted: 1,
      avgFirstResponseLabel: null,
      activeConversations: 1,
    });

    expect(metrics.hero.appointmentsBooked).toBe(0);
    expect(metrics.hero.qualifiedLeads).toBe(0);
    expect(metrics.funnel.appointments).toBe(0);
    expect(metrics.funnel.qualifiedLeads).toBe(0);
  });

  it("counts only staff pipeline marks", () => {
    const metrics = computeExecutiveOverviewMetrics({
      periodRows: [
        {
          ...baseRow,
          id: "c2",
          metadata: {
            pipeline: {
              qualified: { at: "2026-05-02T12:00:00Z", by: "staff-1" },
            },
          },
        },
        {
          ...baseRow,
          id: "c3",
          metadata: {
            pipeline: {
              appointment: { at: "2026-05-03T12:00:00Z", by: "staff-1" },
            },
          },
        },
      ],
      openRows: [],
      conversationsStarted: 2,
      avgFirstResponseLabel: null,
      activeConversations: 0,
    });

    expect(metrics.funnel.qualifiedLeads).toBe(1);
    expect(metrics.hero.qualifiedLeads).toBe(1);
  });

  it("does not inflate visitors beyond real conversations", () => {
    const metrics = computeExecutiveOverviewMetrics({
      periodRows: [],
      openRows: [],
      conversationsStarted: 17,
      avgFirstResponseLabel: null,
      activeConversations: 2,
    });

    expect(metrics.funnel.conversations).toBe(17);
    expect("visitors" in metrics.funnel).toBe(false);
  });
});
