import "server-only";

import type { PostgrestError } from "@supabase/supabase-js";

import { fromPostgrestError } from "@/server/data/postgrest-error";
import { resolveDb } from "@/server/data/internal";
import type { TypedSupabaseClient } from "@/server/db/server-client";
import { err, ok, type Result } from "@/server/result";

const MAX_BATCH = 100;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isMissingRpcError(error: PostgrestError): boolean {
  const msg = error.message.toLowerCase();
  return (
    error.code === "PGRST202" ||
    msg.includes("could not find the function") ||
    (msg.includes("function") && msg.includes("does not exist"))
  );
}

/** RPC requires auth.uid(); service role and some JWT edge cases should use table DELETE. */
function shouldFallbackFromRpcToTableDelete(error: PostgrestError): boolean {
  if (isMissingRpcError(error)) {
    return true;
  }
  const msg = error.message.toLowerCase();
  return (
    error.code === "42501" ||
    msg.includes("unauthorized") ||
    msg.includes("forbidden") ||
    msg.includes("policy")
  );
}

async function deleteViaRpc(
  supabase: TypedSupabaseClient,
  dealershipId: string,
  ids: string[]
): Promise<Result<{ deletedCount: number }> | null> {
  const rpc = await supabase.rpc("staff_delete_conversations", {
    p_dealership_id: dealershipId,
    p_conversation_ids: ids,
  });

  if (!rpc.error) {
    const count =
      typeof rpc.data === "number" && Number.isFinite(rpc.data) ? rpc.data : 0;
    return ok({ deletedCount: count });
  }

  if (shouldFallbackFromRpcToTableDelete(rpc.error)) {
    return null;
  }

  return fromPostgrestError(rpc.error);
}

async function deleteViaTable(
  supabase: TypedSupabaseClient,
  dealershipId: string,
  ids: string[]
): Promise<Result<{ deletedCount: number }>> {
  const res = await supabase
    .from("conversations")
    .delete()
    .eq("dealership_id", dealershipId)
    .in("id", ids)
    .select("id");

  if (res.error) {
    return fromPostgrestError(res.error);
  }

  return ok({ deletedCount: res.data?.length ?? 0 });
}

/**
 * Hard-delete conversations and cascaded messages/events.
 * Uses staff RPC when signed in; falls back to direct DELETE (RLS or service role).
 */
export async function deleteConversationsPermanently(
  dealershipId: string,
  conversationIds: string[],
  db?: TypedSupabaseClient,
  options?: { preferTableDelete?: boolean }
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

  if (!options?.preferTableDelete) {
    const rpcRes = await deleteViaRpc(supabase, d, ids);
    if (rpcRes) {
      if (rpcRes.ok && rpcRes.data.deletedCount > 0) {
        return rpcRes;
      }
      if (!rpcRes.ok) {
        return rpcRes;
      }
      // RPC returned 0 rows — try direct delete (e.g. stale RPC policy).
    }
  }

  return deleteViaTable(supabase, d, ids);
}
