import { describe, expect, it } from "vitest";

import {
  STICKY_OWNER_WINDOW_HOURS,
  isWithinStickyOwnerWindow,
} from "@/server/messaging/inbound/sticky-owner";

function isoHoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

describe("sticky owner window", () => {
  it("accepts conversation activity inside the sticky window", () => {
    const ok = isWithinStickyOwnerWindow({
      last_message_at: isoHoursAgo(STICKY_OWNER_WINDOW_HOURS - 1),
      updated_at: isoHoursAgo(STICKY_OWNER_WINDOW_HOURS - 1),
      created_at: isoHoursAgo(STICKY_OWNER_WINDOW_HOURS - 2),
    });
    expect(ok).toBe(true);
  });

  it("rejects conversation activity outside the sticky window", () => {
    const ok = isWithinStickyOwnerWindow({
      last_message_at: isoHoursAgo(STICKY_OWNER_WINDOW_HOURS + 2),
      updated_at: isoHoursAgo(STICKY_OWNER_WINDOW_HOURS + 2),
      created_at: isoHoursAgo(STICKY_OWNER_WINDOW_HOURS + 3),
    });
    expect(ok).toBe(false);
  });
});
