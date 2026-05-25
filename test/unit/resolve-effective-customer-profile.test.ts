import { describe, expect, it } from "vitest";

import { resolveEffectiveCustomerProfile } from "@/lib/conversation/resolve-effective-customer-profile";

describe("resolveEffectiveCustomerProfile", () => {
  it("uses chat phone over demo CRM placeholder", () => {
    const effective = resolveEffectiveCustomerProfile({
      displayName: "Dan O'Brien",
      email: null,
      phoneE164: "+17055550100",
      customerMessageBodies: [
        "My name is Dan O and my phone is 705-206-3889",
      ],
      aiInsightsProfile: null,
    });

    expect(effective.phoneE164).toContain("705");
    expect(effective.phoneE164).not.toBe("+17055550100");
  });

  it("uses AI insights phone when chat has no number", () => {
    const effective = resolveEffectiveCustomerProfile({
      displayName: "Dan O'Brien",
      email: null,
      phoneE164: "+17055550100",
      customerMessageBodies: ["Hi I need oil change"],
      aiInsightsProfile: {
        name: "Dan O'Brien",
        email: null,
        phone_e164: "+17052063889",
      },
    });

    expect(effective.phoneE164).toBe("+17052063889");
  });
});
