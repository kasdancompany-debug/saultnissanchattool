import { describe, expect, it } from "vitest";

import { readAiInsightsFromMetadata } from "@/lib/conversation/ai-insights-metadata";

describe("readAiInsightsFromMetadata", () => {
  it("normalizes legacy ai_insights missing customer_profile", () => {
    const insights = readAiInsightsFromMetadata({
      ai_insights: {
        intent: "service",
        department: "service",
        urgency: "normal",
        sentiment: "neutral",
        confidence: 0.8,
        intent_level: "medium",
        opportunity_score: 42,
        recommended_action: "Follow up",
      },
    });

    expect(insights).not.toBeNull();
    expect(insights?.customer_profile).toEqual({
      name: null,
      email: null,
      phone_e164: null,
    });
  });
});
