import "server-only";

import { mergeConversationControl } from "@/lib/conversation/control-metadata";
import { notifySalesHandoffAlert } from "@/server/alerts/sales-handoff-alerts";
import { getConversationRowById } from "@/server/data/conversations";
import { insertConversationEvent } from "@/server/data/conversation-events";
import { getMessagesForConversation } from "@/server/data/messages";
import type { TypedSupabaseClient } from "@/server/db/server-client";

/**
 * When AI assist flags human escalation, move open/pending threads to `waiting_for_human`
 * so the inbox shows “Needs human” and staff prioritize review. Idempotent for other statuses.
 */
export async function applyAiHumanEscalationStatus(
  supabase: TypedSupabaseClient,
  dealershipId: string,
  conversationId: string,
  effectiveEscalate: boolean,
  rulesApplied: string[]
): Promise<void> {
  if (!effectiveEscalate) {
    return;
  }

  const conv = await getConversationRowById(
    dealershipId,
    conversationId,
    supabase
  );
  if (!conv.ok) {
    return;
  }

  const status = conv.data.status;
  if (status !== "open" && status !== "pending") {
    return;
  }

  const now = new Date().toISOString();
  const mergedMeta = mergeConversationControl(conv.data.metadata, {
    handling_mode: "waiting_for_human",
  });

  const upd = await supabase
    .from("conversations")
    .update({
      status: "waiting_for_human",
      metadata: mergedMeta,
      updated_at: now,
    })
    .eq("dealership_id", dealershipId)
    .eq("id", conversationId);

  if (upd.error) {
    return;
  }

  await insertConversationEvent(supabase, {
    conversation_id: conversationId,
    event_type: "status_changed",
    actor_user_id: null,
    payload: {
      previous_status: status,
      new_status: "waiting_for_human",
      reason: "ai_assist_escalation",
      rules_applied: rulesApplied,
    },
  });

  await insertConversationEvent(supabase, {
    conversation_id: conversationId,
    event_type: "waiting_for_human",
    actor_user_id: null,
    payload: {
      previous_status: status,
      new_status: "waiting_for_human",
      reason: "ai_assist_escalation",
      rules_applied: rulesApplied,
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
    rulesApplied,
    occurredAt: now,
    customerLabel: conv.data.title?.trim() || "Web chat customer",
    lastCustomerMessage,
    inboxUrl,
  });
}
