import { describe, expect, it } from "vitest";

import {
  aggregateProfileHintsFromTexts,
  extractProfileHintsFromText,
  isPlaceholderCustomerName,
} from "@/lib/conversation/extract-profile-hints";

describe("profile extraction for widget → inbox sync", () => {
  it("extracts Dan O and phone from a typical intro", () => {
    const merged = aggregateProfileHintsFromTexts([
      "My name is Dan O and my phone is 705-206-3669",
    ]);
    expect(merged.name?.toLowerCase()).toContain("dan");
    expect(merged.phoneE164).toBeTruthy();
    expect(isPlaceholderCustomerName("Website visitor")).toBe(true);
    expect(isPlaceholderCustomerName(merged.name)).toBe(false);
  });

  it("extracts phone from follow-up thread when name was in prior message", () => {
    const merged = aggregateProfileHintsFromTexts([
      "Gary Phillips here, 705-555-9999",
      "follow-up?",
    ]);
    expect(merged.name).toBeTruthy();
    expect(merged.phoneE164).toBeTruthy();
  });

  it("parses I'm <name> pattern", () => {
    const h = extractProfileHintsFromText("I'm Billy West, call me at 705-123-4567");
    expect(h.name?.toLowerCase()).toContain("billy");
    expect(h.phoneE164).toBeTruthy();
  });
});
