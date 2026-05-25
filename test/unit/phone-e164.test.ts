import { describe, expect, it } from "vitest";

import {
  normalizeE164,
  phonesEquivalent,
  phoneLookupVariants,
} from "@/lib/phone/e164";

describe("normalizeE164", () => {
  it("adds +1 for 10-digit North American numbers", () => {
    expect(normalizeE164("705-206-3669")).toBe("+17052063669");
    expect(normalizeE164("+7052063669")).toBe("+17052063669");
  });

  it("treats legacy and canonical forms as equivalent", () => {
    expect(phonesEquivalent("+7052063669", "+17052063669")).toBe(true);
    expect(phoneLookupVariants("705-206-3669")).toContain("+17052063669");
  });
});
