import type { Database } from "@/integrations/supabase/database.types";
import { fromPostgrestError } from "@/server/data/postgrest-error";
import type { TypedSupabaseClient } from "@/server/db/server-client";
import { ok, type Result } from "@/server/result";

export type ConversationEventInsert =
  Database["public"]["Tables"]["conversation_events"]["Insert"];

/**
 * Inserts a single audit/event row. Callers control event_type + payload shape.
 */
export async function insertConversationEvent(
  supabase: TypedSupabaseClient,
  row: ConversationEventInsert
): Promise<Result<void>> {
  const res = await supabase.from("conversation_events").insert(row);

  if (res.error) {
    const msg = `${res.error.message ?? ""} ${res.error.details ?? ""} ${res.error.hint ?? ""}`.toLowerCase();
    const isEventEnumMismatch =
      msg.includes("invalid input value for enum conversation_event_type");

    // Local compatibility mode: older DB enum values should not block core inbox actions.
    if (isEventEnumMismatch && process.env.NODE_ENV !== "production") {
      console.warn(
        "[conversation-events] Skipping unsupported event_type in non-production:",
        row.event_type
      );
      return ok(undefined);
    }

    return fromPostgrestError(res.error);
  }

  return ok(undefined);
}
