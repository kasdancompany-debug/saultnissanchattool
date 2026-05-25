import { describe, expect, it } from "vitest";

import { buildContextualWidgetReply } from "@/server/widget/widget-contextual-reply";
import { extractProfileHintsFromText } from "@/lib/conversation/extract-profile-hints";
import {
  mergeExtractedCustomerProfile,
  profileFieldsStillMissing,
} from "@/lib/conversation/extract-profile-hints";

describe("buildContextualWidgetReply", () => {
  it("thanks Gary by name when name and phone are in the message", () => {
    const text =
      "My name is Gary Indiana and my phone number is 705-206-3669";
    const hints = extractProfileHintsFromText(text);
    const merged = mergeExtractedCustomerProfile({
      fromModel: { name: null, email: null, phoneE164: null },
      fromHeuristics: hints,
    });
    const missing = profileFieldsStillMissing({
      displayName: null,
      email: null,
      phoneE164: null,
      extracted: merged,
    });

    expect(hints.name).toBeTruthy();
    expect(hints.phoneE164).toBeTruthy();
    expect(missing).not.toContain("name");
    expect(missing).not.toContain("phone");

    const reply = buildContextualWidgetReply({
      customerMessage: text,
      threadText: text,
      department: "service",
      topic: "service",
      hints: merged,
      missingAfterHints: missing,
    });

    expect(reply.toLowerCase()).toContain("gary");
    expect(reply.toLowerCase()).not.toContain("what's the best name and phone");
  });

  it("does not re-ask for contact on follow-up when profile is complete", () => {
    const thread =
      "My name is Dan O and my phone is 705-555-1234\nHello I need service";
    const reply = buildContextualWidgetReply({
      customerMessage: "follow-up?",
      threadText: thread,
      department: "service",
      topic: "service",
      hints: { name: "Dan O", email: null, phoneE164: "+17055551234" },
      missingAfterHints: [],
      knownDisplayName: "Dan O",
      knownPhoneE164: "+17055551234",
      lastAssistantMessage:
        "Thanks for reaching out. What's the best name and phone number for our team to follow up with you?",
    });

    expect(reply.toLowerCase()).toContain("dan");
    expect(reply.toLowerCase()).not.toContain("best name and phone");
    expect(reply.toLowerCase()).toMatch(/follow up|follow-up|team will/);
  });
});
