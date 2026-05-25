import { config } from "dotenv";
import { describe, expect, it, vi } from "vitest";

config({ path: ".env.local" });

vi.mock("server-only", () => ({}));

describe("inbox closed list load", () => {
  it("loads and maps closed conversations without throwing", async () => {
    const { createClient } = await import("@supabase/supabase-js");
    const { listInboxConversations } = await import("@/server/data/inbox");

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    if (!url || !key) {
      return;
    }

    const supabase = createClient(url, key);
    const { data: staff } = await supabase
      .from("staff_users")
      .select("id,dealership_id,role")
      .eq("email", "marketing@saultnissan.ca")
      .maybeSingle();

    expect(staff).toBeTruthy();

    const res = await listInboxConversations(
      staff!.dealership_id,
      "closed",
      staff!.id,
      true,
      null,
      "highest_score",
      supabase
    );

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.length).toBeGreaterThanOrEqual(0);
      for (const item of res.data) {
        expect(item.opportunity).toBeDefined();
        expect(typeof item.opportunity.score).toBe("number");
        expect(item.card).toBeDefined();
        JSON.stringify(item);
      }
    }
  }, 60_000);
});
