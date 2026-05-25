import { describe, expect, it } from "vitest";

import {
  aggregateProfileHintsFromTexts,
  extractProfileHintsFromText,
  isPlaceholderCustomerName,
} from "@/lib/conversation/extract-profile-hints";
import { deriveConversationIntelligenceTags } from "@/lib/conversation/intelligence-tags";
import { computeOpportunityScore } from "@/lib/opportunity/compute-opportunity";
import { resolveEffectiveCustomerProfile } from "@/lib/conversation/resolve-effective-customer-profile";

describe("person name extraction", () => {
  it("does not treat greeting + vehicle line as a name", () => {
    const h = extractProfileHintsFromText(
      "Hi, my car is a 2018 Altima and I want to trade in"
    );
    expect(h.name).toBeNull();
    expect(isPlaceholderCustomerName("Hi my car is")).toBe(true);
  });

  it("does not capture text before phone when it is not a name", () => {
    const h = extractProfileHintsFromText(
      "hi my car is broken, call me at 705-206-3669"
    );
    expect(h.name).toBeNull();
    expect(h.phoneE164).toBeTruthy();
  });

  it("still extracts real names", () => {
    const merged = aggregateProfileHintsFromTexts([
      "My name is Dan O and my phone is 705-206-3669",
    ]);
    expect(merged.name?.toLowerCase()).toContain("dan");
    expect(isPlaceholderCustomerName(merged.name)).toBe(false);
  });
});

describe("effective customer profile display", () => {
  it("falls back to phone when CRM name is a mis-extracted phrase", () => {
    const profile = resolveEffectiveCustomerProfile({
      displayName: "Hi my car is",
      email: null,
      phoneE164: "+17052063669",
      customerMessageBodies: ["I want to trade in my SUV"],
      aiInsightsProfile: { name: "Hi my car is", email: null, phone_e164: null },
    });
    expect(profile.displayName).toBe("+17052063669");
  });
});

describe("trade-in intent scoring and tags", () => {
  it("tags trade-in widget topic as high intent", () => {
    const tags = deriveConversationIntelligenceTags(
      "trade in trade value want to trade\nI want to trade in"
    );
    expect(tags.some((t) => t.kind === "high_intent")).toBe(true);
    expect(tags.some((t) => t.kind === "low_intent")).toBe(false);
  });

  it("scores trade_value widget intake in the strong band", () => {
    const snap = computeOpportunityScore({
      messageText: "I want to trade in my 2019 Rogue",
      classification: {
        intent: "Trade-in estimate",
        confidence: 0.55,
        urgency: "normal",
        sentiment: "neutral",
      },
      conversationMetadata: {
        widget: { intake_intent: "trade_value" },
      },
      status: "open",
      department: "sales",
    });
    expect(snap.score).toBeGreaterThanOrEqual(65);
    expect(snap.intent_summary.toLowerCase()).toContain("trade");
  });
});
