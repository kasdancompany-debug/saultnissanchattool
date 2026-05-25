import "server-only";

import {
  computeInboxQueueCountsFromRows,
  closedStatusesForInboxCounts,
  openStatusesForInboxCounts,
  type InboxQueueCounts,
} from "@/lib/inbox/compute-queue-counts";
import { resolveDb } from "@/server/data/internal";
import type { TypedSupabaseClient } from "@/server/db/server-client";
import { err, ok, type Result } from "@/server/result";

export type { InboxQueueCounts };

export async function getInboxQueueCounts(
  dealershipId: string,
  staffUserId: string,
  includeDealershipWide: boolean,
  db?: TypedSupabaseClient
): Promise<Result<InboxQueueCounts>> {
  const id = dealershipId?.trim();
  const sid = staffUserId?.trim();
  if (!id || !sid) {
    return err("VALIDATION", "dealershipId and staffUserId are required");
  }

  const supabase = await resolveDb(db);
  const openStatuses = openStatusesForInboxCounts();
  const closedStatuses = closedStatusesForInboxCounts();

  const [openRowsRes, closedCountRes] = await Promise.all([
    supabase
      .from("conversations")
      .select("status, assigned_to_user_id, department")
      .eq("dealership_id", id)
      .in("status", openStatuses),
    supabase
      .from("conversations")
      .select("id", { count: "exact", head: true })
      .eq("dealership_id", id)
      .in("status", closedStatuses),
  ]);

  if (openRowsRes.error) {
    return err("DB_ERROR", openRowsRes.error.message);
  }
  if (closedCountRes.error) {
    return err("DB_ERROR", closedCountRes.error.message);
  }

  return ok(
    computeInboxQueueCountsFromRows(
      openRowsRes.data ?? [],
      closedCountRes.count ?? 0,
      sid,
      includeDealershipWide
    )
  );
}
