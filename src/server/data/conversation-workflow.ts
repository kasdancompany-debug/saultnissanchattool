import { assignConversation } from "@/server/data/assignments";
import type { StaffRole } from "@/integrations/supabase/database.types";
import {
  humanManualOnlyControlPatch,
  mergeConversationControl,
} from "@/lib/conversation/control-metadata";
import { notifySalesHandoffAlert } from "@/server/alerts/sales-handoff-alerts";
import { insertConversationEvent } from "@/server/data/conversation-events";
import { getConversationRowById } from "@/server/data/conversations";
import { getMessagesForConversation } from "@/server/data/messages";
import { resolveDb } from "@/server/data/internal";
import { fromPostgrestError } from "@/server/data/postgrest-error";
import type { TypedSupabaseClient } from "@/server/db/server-client";
import type { PostgrestError } from "@supabase/supabase-js";
import { err, ok, type Err, type Result } from "@/server/result";

import type { ConversationRow } from "./conversations";

const TERMINAL: import("@/integrations/supabase/database.types").ConversationStatus[] =
  ["closed", "archived", "spam"];

export type ClaimConversationInput = {
  dealershipId: string;
  conversationId: string;
  staffUserId: string;
  /**
   * True when taking ownership from another teammate (explicit “Take over” path).
   * False for unassigned queue, resume (`waiting_for_human` with you as owner), etc.
   */
  takeover: boolean;
};

/**
 * Staff claims ownership with human-led control metadata, AI assist (not autopilot), and
 * optional `waiting_for_human` → `open`.
 *
 * **Server-side safety (no optimistic UI tricks required)**
 *
 * Implemented as the `claim_conversation` Postgres RPC: one transaction, `SELECT … FOR UPDATE`
 * on the conversation row, then assignment row + `conversation_events` (`assignment_created`,
 * `human_claimed`, optional `status_changed`, optional `ai_assist_enabled`). Concurrent requests on the same thread are
 * **serialized** by the row lock.
 *
 * **Compare-and-swap when `takeover` is false:** if another teammate already owns the thread,
 * the RPC raises `CLAIM_CONFLICT` so two operators cannot silently race on an unassigned claim
 * after the first commit — the second must refresh or use the takeover path.
 */
export async function claimConversation(
  input: ClaimConversationInput,
  db?: TypedSupabaseClient
): Promise<Result<ConversationRow>> {
  if (
    !input.dealershipId?.trim() ||
    !input.conversationId?.trim() ||
    !input.staffUserId?.trim()
  ) {
    return err(
      "VALIDATION",
      "dealershipId, conversationId, and staffUserId are required"
    );
  }

  const supabase = await resolveDb(db);

  const rpc = await supabase.rpc("claim_conversation", {
    p_dealership_id: input.dealershipId.trim(),
    p_conversation_id: input.conversationId.trim(),
    p_staff_user_id: input.staffUserId.trim(),
    p_takeover: input.takeover,
  });

  if (rpc.error) {
    if (isMissingClaimConversationRpc(rpc.error)) {
      return claimConversationFallback(input, supabase);
    }
    return fromClaimConversationRpcError(rpc.error);
  }

  const row = rpc.data as ConversationRow | null;
  if (!row) {
    return err("DATABASE_ERROR", "claim_conversation returned no row");
  }

  return ok(row);
}

function isMissingClaimConversationRpc(error: PostgrestError): boolean {
  const hint = `${error.message ?? ""} ${error.hint ?? ""} ${error.details ?? ""}`.toLowerCase();
  return (
    hint.includes("could not find the function public.claim_conversation") ||
    hint.includes("function public.claim_conversation") ||
    hint.includes("schema cache")
  );
}

async function claimConversationFallback(
  input: ClaimConversationInput,
  db: TypedSupabaseClient
): Promise<Result<ConversationRow>> {
  const conversationRes = await getConversationRowById(
    input.dealershipId,
    input.conversationId,
    db
  );
  if (!conversationRes.ok) {
    return conversationRes;
  }

  const conversation = conversationRes.data;
  if (TERMINAL.includes(conversation.status)) {
    return err("FORBIDDEN", "This conversation cannot be claimed.");
  }
  if (conversation.assigned_to_user_id === input.staffUserId) {
    return err("VALIDATION", "You already own this conversation.");
  }
  if (
    !input.takeover &&
    conversation.assigned_to_user_id &&
    conversation.assigned_to_user_id !== input.staffUserId
  ) {
    return err(
      "CONFLICT",
      "Another teammate already claimed this conversation. Refresh the inbox."
    );
  }

  const now = new Date().toISOString();
  const nextStatus =
    conversation.status === "waiting_for_human" ? "open" : conversation.status;
  const nextMetadata = mergeConversationControl(
    conversation.metadata ?? {},
    humanManualOnlyControlPatch(input.staffUserId)
  );

  const updateRes = await db
    .from("conversations")
    .update({
      assigned_to_user_id: input.staffUserId,
      status: nextStatus,
      metadata: nextMetadata,
      updated_at: now,
    })
    .eq("dealership_id", input.dealershipId)
    .eq("id", input.conversationId)
    .select("*")
    .single();

  if (updateRes.error) {
    return fromPostgrestError(updateRes.error);
  }

  await db.from("conversation_assignments").insert({
    conversation_id: input.conversationId,
    assigned_to_user_id: input.staffUserId,
    assigned_by_user_id: input.staffUserId,
    note: input.takeover ? "takeover" : "claim",
    metadata: {
      source: "claim_conversation_fallback",
    },
  });

  await insertConversationEvent(db, {
    conversation_id: input.conversationId,
    event_type: "human_claimed",
    actor_user_id: input.staffUserId,
    payload: {
      takeover: input.takeover,
      previous_assigned_to_user_id: conversation.assigned_to_user_id,
      assigned_to_user_id: input.staffUserId,
      fallback_path: true,
    },
  });

  return ok(updateRes.data as ConversationRow);
}

function fromClaimConversationRpcError(error: PostgrestError): Err {
  const hint = `${error.message ?? ""} ${error.hint ?? ""} ${error.details ?? ""}`;
  if (hint.includes("CLAIM_CONFLICT")) {
    return err(
      "CONFLICT",
      "Another teammate already claimed this conversation. Refresh the inbox."
    );
  }
  if (hint.includes("ALREADY_CLAIMED")) {
    return err("VALIDATION", "You already own this conversation.");
  }
  if (hint.includes("CONVERSATION_TERMINAL")) {
    return err("FORBIDDEN", "This conversation cannot be claimed.");
  }
  if (hint.includes("CONVERSATION_NOT_FOUND")) {
    return err("NOT_FOUND", "Conversation not found");
  }
  if (hint.includes("INVALID_STAFF")) {
    return err("NOT_FOUND", "Staff profile was not found or is inactive.");
  }
  if (hint.includes("FORBIDDEN")) {
    return err("FORBIDDEN", "You do not have permission to claim this conversation.");
  }
  return fromPostgrestError(error);
}

export type ReassignConversationInput = {
  dealershipId: string;
  conversationId: string;
  /** Staff member who will own the thread */
  assignToUserId: string;
  /** Actor performing the reassignment */
  actorUserId: string;
};

/**
 * Reassigns to another teammate (atomic `assign_conversation` RPC: row lock + history + event).
 */
export async function reassignConversation(
  input: ReassignConversationInput,
  db?: TypedSupabaseClient
): Promise<Result<ConversationRow>> {
  const convRes = await getConversationRowById(
    input.dealershipId,
    input.conversationId,
    db
  );
  if (!convRes.ok) {
    return convRes;
  }

  if (TERMINAL.includes(convRes.data.status)) {
    return err("FORBIDDEN", "Cannot reassign a closed conversation.");
  }

  return assignConversation(
    {
      dealershipId: input.dealershipId,
      conversationId: input.conversationId,
      assignedToUserId: input.assignToUserId,
      assignedByUserId: input.actorUserId,
      note: "reassign",
    },
    db
  );
}

export type UnassignConversationInput = {
  dealershipId: string;
  conversationId: string;
  actorUserId: string;
  actorRole: StaffRole;
};

/**
 * Clears `conversations.assigned_to_user_id` so the thread returns to the unassigned queue.
 * Restricted to manager/admin workflows.
 */
export async function unassignConversation(
  input: UnassignConversationInput,
  db?: TypedSupabaseClient
): Promise<Result<ConversationRow>> {
  if (input.actorRole !== "admin" && input.actorRole !== "manager") {
    return err(
      "FORBIDDEN",
      "Only managers and admins can move a customer back to unassigned."
    );
  }

  const convRes = await getConversationRowById(
    input.dealershipId,
    input.conversationId,
    db
  );
  if (!convRes.ok) {
    return convRes;
  }
  if (TERMINAL.includes(convRes.data.status)) {
    return err("FORBIDDEN", "Cannot unassign a closed conversation.");
  }
  if (!convRes.data.assigned_to_user_id) {
    return err("VALIDATION", "Conversation is already unassigned.");
  }

  const supabase = await resolveDb(db);
  const res = await supabase
    .from("conversations")
    .update({
      assigned_to_user_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq("dealership_id", input.dealershipId.trim())
    .eq("id", input.conversationId.trim())
    .select("*")
    .single();

  if (res.error) {
    return fromPostgrestError(res.error);
  }

  const eventRes = await insertConversationEvent(supabase, {
    conversation_id: input.conversationId.trim(),
    event_type: "metadata_changed",
    actor_user_id: input.actorUserId.trim(),
    payload: {
      reason: "manager_unassign",
      previous_assigned_to_user_id: convRes.data.assigned_to_user_id,
      assigned_to_user_id: null,
    },
  });
  if (!eventRes.ok) {
    return eventRes;
  }

  return ok(res.data as ConversationRow);
}

export type StaffEscalateConversationInput = {
  dealershipId: string;
  conversationId: string;
  actorUserId: string;
  reason?: string;
};

/**
 * Staff Escalate (Insights quick action): move thread to Needs human, pause AI autopilot
 * posture, and notify the team — same queue as AI escalation, with staff attribution.
 */
export async function staffEscalateConversation(
  input: StaffEscalateConversationInput,
  db?: TypedSupabaseClient
): Promise<Result<ConversationRow>> {
  const dealershipId = input.dealershipId.trim();
  const conversationId = input.conversationId.trim();
  const actorUserId = input.actorUserId.trim();
  const reason = input.reason?.trim() || "staff_escalate_copilot";

  if (!dealershipId || !conversationId || !actorUserId) {
    return err("VALIDATION", "dealershipId, conversationId, and actorUserId are required");
  }

  const supabase = await resolveDb(db);
  const conv = await getConversationRowById(dealershipId, conversationId, supabase);
  if (!conv.ok) {
    return conv;
  }

  if (TERMINAL.includes(conv.data.status)) {
    return err("FORBIDDEN", "Cannot escalate a closed conversation.");
  }

  if (conv.data.status === "waiting_for_human") {
    return ok(conv.data);
  }

  const previousStatus = conv.data.status;
  const now = new Date().toISOString();
  const mergedMeta = mergeConversationControl(conv.data.metadata, {
    handling_mode: "waiting_for_human",
    ai_autopilot: false,
  });

  const upd = await supabase
    .from("conversations")
    .update({
      status: "waiting_for_human",
      metadata: mergedMeta,
      updated_at: now,
    })
    .eq("dealership_id", dealershipId)
    .eq("id", conversationId)
    .select("*")
    .single();

  if (upd.error || !upd.data) {
    return fromPostgrestError(upd.error);
  }

  await insertConversationEvent(supabase, {
    conversation_id: conversationId,
    event_type: "status_changed",
    actor_user_id: actorUserId,
    payload: {
      previous_status: previousStatus,
      new_status: "waiting_for_human",
      reason,
    },
  });

  await insertConversationEvent(supabase, {
    conversation_id: conversationId,
    event_type: "waiting_for_human",
    actor_user_id: actorUserId,
    payload: {
      previous_status: previousStatus,
      new_status: "waiting_for_human",
      reason,
    },
  });

  let lastCustomerMessage: string | null = null;
  const msgs = await getMessagesForConversation(dealershipId, conversationId, {
    limit: 12,
    db: supabase,
  });
  if (msgs.ok) {
    const latest = [...msgs.data].reverse().find((m) => m.sender_type === "customer");
    lastCustomerMessage = latest?.body?.trim() ?? null;
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "") ?? "";
  const inboxUrl =
    appUrl.length > 0
      ? `${appUrl}/inbox?filter=all_open&c=${encodeURIComponent(conversationId)}`
      : null;

  await notifySalesHandoffAlert({
    dealershipId,
    conversationId,
    department: conv.data.department,
    assignedToUserId: conv.data.assigned_to_user_id,
    rulesApplied: [reason],
    occurredAt: now,
    customerLabel: conv.data.title?.trim() || "Customer",
    lastCustomerMessage,
    inboxUrl,
  });

  return ok(upd.data as ConversationRow);
}
