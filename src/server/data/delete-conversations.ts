import "server-only";

import { fromPostgrestError } from "@/server/data/postgrest-error";
import { resolveDb } from "@/server/data/internal";
import type { TypedSupabaseClient } from "@/server/db/server-client";
import { err, ok, type Result } from "@/server/result";

const MAX_BATCH = 100;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Hard-delete conversations and cascaded messages/events (RLS: privileged staff only).
 */
export async function deleteConversationsPermanently(
  dealershipId: string,
  conversationIds: string[],
  db?: TypedSupabaseClient
): Promise<Result<{ deletedCount: number }>> {
  const d = dealershipId?.trim();
  if (!d) {
    return err("VALIDATION", "dealershipId is required");
  }

  const ids = [
    ...new Set(
      conversationIds
        .map((id) => id.trim())
        .filter((id) => UUID_RE.test(id))
    ),
  ];

  if (ids.length === 0) {
    return err("VALIDATION", "Select at least one conversation to delete.");
  }

  if (ids.length > MAX_BATCH) {
    return err(
      "VALIDATION",
      `Delete at most ${MAX_BATCH} conversations at a time.`
    );
  }

  const supabase = await resolveDb(db);
  const res = await supabase
    .from("conversations")
    .delete()
    .eq("dealership_id", d)
    .in("id", ids)
    .select("id");

  if (res.error) {
    return fromPostgrestError(res.error);
  }

  return ok({ deletedCount: res.data?.length ?? 0 });
}
