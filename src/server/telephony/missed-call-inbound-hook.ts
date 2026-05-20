import "server-only";

import { captureServerException } from "@/lib/observability/server-capture";
import { createSupabaseAdminClient } from "@/integrations/supabase/admin";
import { getConversationRowById } from "@/server/data/conversations";
import { insertConversationEvent } from "@/server/data/conversation-events";
import { mergeConversationMetadata } from "@/server/telephony/conversation-metadata-merge";
import { classifyMissedCallDepartmentReply } from "@/server/telephony/classify-missed-call-reply";
import type { MissedCallFlowState } from "@/server/telephony/types";

function readMissedCallFlow(metadata: unknown): MissedCallFlowState | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }
  const m = metadata as { missed_call_flow?: MissedCallFlowState };
  return m.missed_call_flow ?? null;
}

/**
 * After an inbound customer SMS is stored, routes the thread by department when
 * this conversation is in the missed-call follow-up state.
 */
export async function tryApplyMissedCallDepartmentReply(input: {
  dealershipId: string;
  conversationId: string;
  inboundCustomerMessageBody: string;
}): Promise<void> {
  const supabase = createSupabaseAdminClient();

  const conv = await getConversationRowById(
    input.dealershipId,
    input.conversationId,
    supabase
  );
  if (!conv.ok) {
    return;
  }

  const flow = readMissedCallFlow(conv.data.metadata);
  if (!flow || flow.phase !== "awaiting_department") {
    return;
  }

  const nextDept = classifyMissedCallDepartmentReply(
    input.inboundCustomerMessageBody
  );
  if (!nextDept) {
    return;
  }

  const previousDepartment = conv.data.department;
  const now = new Date().toISOString();
  const nextFlow: MissedCallFlowState = {
    ...flow,
    phase: "routed",
    routed_department: nextDept,
    routed_at: now,
  };

  const rowUpdate: {
    department?: typeof nextDept;
    metadata: ReturnType<typeof mergeConversationMetadata>;
    updated_at: string;
  } = {
    metadata: mergeConversationMetadata(conv.data.metadata, {
      missed_call_flow: nextFlow,
    }),
    updated_at: now,
  };

  if (previousDepartment !== nextDept) {
    rowUpdate.department = nextDept;
  }

  const updated = await supabase
    .from("conversations")
    .update(rowUpdate)
    .eq("dealership_id", input.dealershipId)
    .eq("id", input.conversationId)
    .select()
    .single();

  if (updated.error) {
    captureServerException(
      new Error(updated.error.message || "Conversation update failed"),
      {
        where: "missed_call_department_reply_update",
        conversationId: input.conversationId,
        dealershipId: input.dealershipId,
        pgCode: updated.error.code,
      }
    );
    return;
  }

  if (previousDepartment !== nextDept) {
    const deptEv = await insertConversationEvent(supabase, {
      conversation_id: input.conversationId,
      event_type: "department_changed",
      actor_user_id: null,
      payload: {
        previous_department: previousDepartment,
        new_department: nextDept,
        reason: "missed_call_sms_reply",
      },
    });

    if (!deptEv.ok) {
      captureServerException(new Error(deptEv.error.message), {
        where: "missed_call_department_changed_event",
        code: deptEv.error.code,
        conversationId: input.conversationId,
      });
      return;
    }
  }

  const routingEv = await insertConversationEvent(supabase, {
    conversation_id: input.conversationId,
    event_type: "routing_rule_applied",
    actor_user_id: null,
    payload: {
      rule: "missed_call_department_capture",
      source: "sms_inbound_classification",
      classified_department: nextDept,
      department_changed: previousDepartment !== nextDept,
    },
  });

  if (!routingEv.ok) {
    captureServerException(new Error(routingEv.error.message), {
      where: "missed_call_routing_rule_event",
      code: routingEv.error.code,
      conversationId: input.conversationId,
    });
  }
}
