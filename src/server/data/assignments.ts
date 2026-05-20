import type { Tables } from "@/integrations/supabase/database.types";
import type { ConversationRow } from "@/server/data/conversations";
import { getConversationRowById } from "@/server/data/conversations";
import { resolveDb } from "@/server/data/internal";
import { fromPostgrestError } from "@/server/data/postgrest-error";
import type { TypedSupabaseClient } from "@/server/db/server-client";
import type { PostgrestError } from "@supabase/supabase-js";
import { err, ok, type Err, type Result } from "@/server/result";

/**
 * Assignment history rows + `assignConversation` orchestration (conversation row + event).
 * Callers must pass dealershipId on every operation to preserve tenant safety.
 */
export type ConversationAssignmentRow = Tables<"conversation_assignments">;

export type AssignConversationInput = {
  dealershipId: string;
  conversationId: string;
  assignedToUserId: string;
  assignedByUserId: string | null;
  note?: string | null;
};

/**
 * Sets `conversations.assigned_to_user_id`, appends `conversation_assignments`, and records
 * `assignment_created` via the `assign_conversation` database function (single DB transaction).
 *
 * **Race conditions & consistency**
 *
 * - **Single request:** The RPC runs update + history + event in **one transaction** (all commit
 *   or none), so there is no window where the conversation row points at a new assignee without
 *   matching history and audit event.
 *
 * - **Concurrent assigns:** The function locks the conversation row (`SELECT … FOR UPDATE`)
 *   before mutating. Two overlapping assigns on the same thread are **serialized**; each produces
 *   its own history + event in commit order. Terminal conversations are rejected.
 *
 * **Claim / unassigned races:** Use `claimConversation` (`claim_conversation` RPC), which
 * applies compare-and-swap rules when `takeover` is false so two staff cannot silently race on an
 * unassigned thread after the first successful claim.
 */
export async function assignConversation(
  input: AssignConversationInput,
  db?: TypedSupabaseClient
): Promise<Result<ConversationRow>> {
  if (
    !input.dealershipId?.trim() ||
    !input.conversationId?.trim() ||
    !input.assignedToUserId?.trim()
  ) {
    return err(
      "VALIDATION",
      "dealershipId, conversationId, and assignedToUserId are required"
    );
  }

  const dealershipId = input.dealershipId.trim();
  const conversationId = input.conversationId.trim();
  const assignedToUserId = input.assignedToUserId.trim();
  const assignedByUserId = input.assignedByUserId?.trim() || null;

  const supabase = await resolveDb(db);

  const rpc = await supabase.rpc("assign_conversation", {
    p_dealership_id: dealershipId,
    p_conversation_id: conversationId,
    p_assigned_to_user_id: assignedToUserId,
    p_assigned_by_user_id: assignedByUserId,
    p_note: input.note ?? null,
  });

  if (rpc.error) {
    return fromAssignConversationRpcError(rpc.error);
  }

  const row = rpc.data as ConversationRow | null;
  if (!row) {
    return err("DATABASE_ERROR", "assign_conversation returned no row");
  }

  return ok(row);
}

function fromAssignConversationRpcError(error: PostgrestError): Err {
  const hint = `${error.message ?? ""} ${error.hint ?? ""} ${error.details ?? ""}`;
  if (hint.includes("ALREADY_ASSIGNED")) {
    return err("VALIDATION", "Already assigned to this teammate.");
  }
  if (hint.includes("INVALID_ASSIGNEE")) {
    return err("NOT_FOUND", "That teammate was not found or is inactive.");
  }
  if (hint.includes("INVALID_ACTOR")) {
    return err("NOT_FOUND", "Actor staff user was not found or is inactive.");
  }
  if (hint.includes("CONVERSATION_NOT_FOUND")) {
    return err("NOT_FOUND", "Conversation not found");
  }
  if (hint.includes("CONVERSATION_TERMINAL")) {
    return err("FORBIDDEN", "Cannot change assignment on a closed conversation.");
  }
  return fromPostgrestError(error);
}

export async function listAssignmentsForConversation(
  dealershipId: string,
  conversationId: string,
  db?: TypedSupabaseClient
): Promise<Result<ConversationAssignmentRow[]>> {
  const supabase = await resolveDb(db);
  const access = await getConversationRowById(dealershipId, conversationId, supabase);
  if (!access.ok) {
    return access;
  }

  const res = await supabase
    .from("conversation_assignments")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false });

  if (res.error) {
    return fromPostgrestError(res.error);
  }

  return ok(res.data ?? []);
}

export async function getAssignmentById(
  dealershipId: string,
  assignmentId: string,
  db?: TypedSupabaseClient
): Promise<Result<ConversationAssignmentRow>> {
  const supabase = await resolveDb(db);
  const res = await supabase
    .from("conversation_assignments")
    .select("*")
    .eq("id", assignmentId)
    .maybeSingle();

  if (res.error) {
    return fromPostgrestError(res.error);
  }

  if (!res.data) {
    return err("NOT_FOUND", "Assignment not found");
  }

  const conv = await getConversationRowById(
    dealershipId,
    res.data.conversation_id,
    supabase
  );
  if (!conv.ok) {
    return err("NOT_FOUND", "Assignment not found");
  }

  return ok(res.data);
}
