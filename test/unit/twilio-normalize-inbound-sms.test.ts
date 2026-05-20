import { describe, expect, it } from "vitest";

import { normalizeTwilioInboundSms } from "@/server/integrations/twilio/normalize-inbound-sms";

describe("normalizeTwilioInboundSms", () => {
  it("accepts media-only inbound messages", () => {
    const result = normalizeTwilioInboundSms({
      MessageSid: "SM0123456789abcdef0123456789abcdef",
      From: "+17055550199",
      To: "+17055550100",
      Body: "",
      NumMedia: "1",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.text).toBe("[media message]");
    }
  });

  it("rejects empty body when no media", () => {
    const result = normalizeTwilioInboundSms({
      MessageSid: "SM0123456789abcdef0123456789abcdef",
      From: "+17055550199",
      To: "+17055550100",
      Body: "",
      NumMedia: "0",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("VALIDATION");
    }
  });
});
