import { describe, expect, it } from "vitest";

import {
  isTwilioFormFieldMap,
  twilioSmsInboundFieldError,
} from "@/integrations/twilio/webhook-payload";

describe("twilio webhook payload validation", () => {
  it("rejects non-string field values", () => {
    expect(isTwilioFormFieldMap({ MessageSid: "SMabc", Count: 1 })).toBe(false);
  });

  it("reports invalid MessageSid format", () => {
    const err = twilioSmsInboundFieldError({
      MessageSid: "not-a-sid",
      From: "+17055550100",
      To: "+17055550101",
      Body: "hi",
    });
    expect(err).toBe("Invalid MessageSid format.");
  });

  it("accepts valid base inbound fields", () => {
    const err = twilioSmsInboundFieldError({
      MessageSid: "SM0123456789abcdef0123456789abcdef",
      From: "+17055550100",
      To: "+17055550101",
      Body: "hello",
    });
    expect(err).toBeNull();
  });
});
