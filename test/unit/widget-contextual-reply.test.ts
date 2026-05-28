import { describe, expect, it } from "vitest";

import { ensureDistinctAssistantReply } from "@/lib/ai/assistant-reply-dedupe";
import { buildContextualWidgetReply } from "@/server/widget/widget-contextual-reply";

const genericHandoff =
  "Got it, Dan — thanks for those details. A teammate will pick this up for used vehicle. Anything else we should pass along (timing, vehicle, or service need)?";

describe("widget contextual reply", () => {
  it("acknowledges new vehicle details instead of repeating handoff template", () => {
    const reply = buildContextualWidgetReply({
      customerMessage: "its a 2025 mazda cx5 and I want something newer",
      threadText: "I want a new car\nMy name is Dan O'Brien and my phone is 7052063669",
      department: "sales",
      topic: "used_vehicle",
      hints: { name: "Dan O'Brien", email: null, phoneE164: "+17052063669" },
      missingAfterHints: [],
      knownDisplayName: "Dan O'Brien",
      knownPhoneE164: "+17052063669",
      lastAssistantMessage: genericHandoff,
    });
    expect(reply).not.toContain("Anything else we should pass along");
    expect(reply.toLowerCase()).toMatch(/mazda|cx-5|newer/);
  });

  it("dedupes identical consecutive assistant lines", () => {
    const next = ensureDistinctAssistantReply({
      proposed: genericHandoff,
      lastAssistantMessage: genericHandoff,
      latestCustomerMessage: "its a 2025 mazda cx5 and I want something newer",
    });
    expect(next).not.toBe(genericHandoff);
    expect(next.toLowerCase()).toMatch(/mazda|cx-5|new|used/);
  });
});
