import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        limit: vi.fn(async () => ({ data: [{ id: "dealer-1" }], error: null })),
      })),
    })),
  })),
}));

vi.mock("@/server/data/dealership-channel-accounts", () => ({
  findTwilioInboundRouteByLine: vi.fn(async () => ({ ok: true, data: null })),
}));

vi.mock("@/server/data/dealerships", () => ({
  findDealershipByTwilioPhoneE164: vi.fn(async () => ({ ok: true, data: null })),
}));

vi.mock("@/lib/env/twilio-server", () => ({
  getTwilioServerEnv: vi.fn(() => ({
    TWILIO_PHONE_NUMBER: "+17055550100",
  })),
}));

import { getTwilioServerEnv } from "@/lib/env/twilio-server";
import { resolveDealershipIdFromDialedNumber } from "@/server/telephony/resolve-dealership-by-line";

describe("resolveDealershipIdFromDialedNumber", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fails validation for non-E164 dialed numbers", async () => {
    const result = await resolveDealershipIdFromDialedNumber("705-555-0100 ext 2");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("VALIDATION");
    }
  });

  it("returns config error when Twilio env cannot be read", async () => {
    vi.mocked(getTwilioServerEnv).mockImplementationOnce(() => {
      throw new Error("bad env");
    });

    const result = await resolveDealershipIdFromDialedNumber("+17055550100");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("CONFIG_ERROR");
    }
  });
});
