import type { Tables } from "@/integrations/supabase/database.types";
import { getConversationRowById } from "@/server/data/conversations";
import { resolveDb } from "@/server/data/internal";
import { fromPostgrestError } from "@/server/data/postgrest-error";
import type { TypedSupabaseClient } from "@/server/db/server-client";
import { ok, type Result } from "@/server/result";

export type ConversationEventRow = Tables<"conversation_events">;

/**
 * Chronological audit events for one conversation (dealership-scoped).
 */
export async function listConversationEventsForConversation(
  dealershipId: string,
  conversationId: string,
  db?: TypedSupabaseClient
): Promise<Result<ConversationEventRow[]>> {
  const supabase = await resolveDb(db);

  const conv = await getConversationRowById(
    dealershipId,
    conversationId,
    supabase
  );
  if (!conv.ok) {
    return conv;
  }

  const res = await supabase
    .from("conversation_events")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

  if (res.error) {
    return fromPostgrestError(res.error);
  }

  return ok(res.data ?? []);
}
