import { describe, expect, it } from "vitest";

import { classifyLeadSource } from "@/lib/analytics/lead-source-attribution";

describe("classifyLeadSource", () => {
  it("classifies web widget intake as website, not organic", () => {
    expect(
      classifyLeadSource({
        channel: "web_chat",
        metadata: {
          widget: { page_path: "/widget?slug=sault-nissan" },
          lead_capture: { intent: "service", name: "Test", phone_e164: "+15551234567" },
        },
      })
    ).toBe("website");
  });

  it("classifies empty-referrer widget as website", () => {
    expect(
      classifyLeadSource({
        channel: "web_chat",
        metadata: { widget: { source: "website_widget", referrer: "" } },
      })
    ).toBe("website");
  });

  it("classifies google ads utm as google_ads", () => {
    expect(
      classifyLeadSource({
        channel: "web_chat",
        metadata: { widget: { utm: { utm_medium: "cpc", utm_source: "google" } } },
      })
    ).toBe("google_ads");
  });

  it("classifies organic search referrer as organic", () => {
    expect(
      classifyLeadSource({
        channel: "web_chat",
        metadata: { widget: { referrer: "https://www.google.com/search?q=nissan" } },
      })
    ).toBe("organic");
  });

  it("classifies sms channel as sms", () => {
    expect(
      classifyLeadSource({
        channel: "sms",
        metadata: {},
      })
    ).toBe("sms");
  });
});
