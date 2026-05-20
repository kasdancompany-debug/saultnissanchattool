import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env/twilio-server", () => ({
  getTwilioServerEnv: vi.fn(() => ({ TWILIO_AUTH_TOKEN: "token" })),
}));

vi.mock("@/server/integrations/twilio/validate-request", () => ({
  validateTwilioWebhookSignature: vi.fn(() => true),
}));

vi.mock("@/server/integrations/twilio/persist-inbound-sms", () => ({
  processTwilioInboundSms: vi.fn(async () => ({
    ok: false,
    error: { code: "VALIDATION", message: "bad payload" },
  })),
}));

import { handleTwilioInboundSmsPost } from "@/server/integrations/twilio/inbound-sms-webhook";

describe("handleTwilioInboundSmsPost", () => {
  it("returns TwiML 200 for validation errors to avoid retries", async () => {
    const body = new URLSearchParams({
      MessageSid: "SM0123456789abcdef0123456789abcdef",
      From: "+17055550199",
      To: "+17055550100",
      Body: "test",
    });
    const req = new Request("https://example.com/api/webhooks/twilio/inbound", {
      method: "POST",
      body,
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "x-twilio-signature": "sig",
      },
    });

    const res = await handleTwilioInboundSmsPost(req);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/xml");
  });
});
