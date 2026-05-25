"use server";

import { revalidatePath } from "next/cache";

import { requireStaff } from "@/server/auth/staff";
import type { PipelineOutcomeKey } from "@/lib/conversation/pipeline-outcomes";
import { updateConversationDepartment, updateConversationStatus } from "@/server/data/conversations";
import {
  clearConversationPipelineOutcome,
  setConversationPipelineOutcome,
} from "@/server/data/conversation-pipeline";
import {
  claimConversation,
  reassignConversation,
  unassignConversation,
} from "@/server/data/conversation-workflow";
import { staffCanEditDealershipSettings } from "@/server/settings/staff-privilege";
import type { InboxConversationActionState } from "./conversation-action-states";

export async function inboxConversationAction(
  _prev: InboxConversationActionState,
  formData: FormData
): Promise<InboxConversationActionState> {
  const intent = String(formData.get("intent") ?? "");
  const conversationId = String(formData.get("conversationId") ?? "").trim();

  if (!conversationId) {
    return { ok: false, error: "Missing conversation." };
  }

  const staff = await requireStaff();
  const canManageAssignments = staffCanEditDealershipSettings(staff);

  switch (intent) {
    case "claim": {
      const takeover = formData.get("takeover") === "1";
      const res = await claimConversation({
        dealershipId: staff.dealership_id,
        conversationId,
        staffUserId: staff.id,
        takeover,
      });
      if (!res.ok) {
        return { ok: false, error: res.error.message };
      }
      break;
    }
    case "reassign": {
      if (!canManageAssignments) {
        return {
          ok: false,
          error:
            "Only managers and admins can reassign customer ownership.",
        };
      }
      const assignToUserId = String(formData.get("assignToUserId") ?? "").trim();
      if (!assignToUserId) {
        return { ok: false, error: "Choose a teammate to assign." };
      }
      const res = await reassignConversation({
        dealershipId: staff.dealership_id,
        conversationId,
        assignToUserId,
        actorUserId: staff.id,
      });
      if (!res.ok) {
        return { ok: false, error: res.error.message };
      }
      break;
    }
    case "unassign": {
      if (!canManageAssignments) {
        return {
          ok: false,
          error: "Only managers and admins can move a customer back to unassigned.",
        };
      }
      const res = await unassignConversation({
        dealershipId: staff.dealership_id,
        conversationId,
        actorUserId: staff.id,
        actorRole: staff.role,
      });
      if (!res.ok) {
        return { ok: false, error: res.error.message };
      }
      break;
    }
    case "escalate": {
      const res = await updateConversationStatus(
        staff.dealership_id,
        conversationId,
        "waiting_for_human",
        staff.id,
        { reason: "staff_escalate_copilot" }
      );
      if (!res.ok) {
        return { ok: false, error: res.error.message };
      }
      break;
    }
    case "mark_pending": {
      const res = await updateConversationStatus(
        staff.dealership_id,
        conversationId,
        "pending",
        staff.id,
        { reason: "staff_mark_pending" }
      );
      if (!res.ok) {
        return { ok: false, error: res.error.message };
      }
      break;
    }
    case "close": {
      const res = await updateConversationStatus(
        staff.dealership_id,
        conversationId,
        "closed",
        staff.id,
        { reason: "staff_close" }
      );
      if (!res.ok) {
        return { ok: false, error: res.error.message };
      }
      break;
    }
    case "mark_department_sales":
    case "mark_department_service":
    case "mark_department_general": {
      const nextDepartment =
        intent === "mark_department_sales"
          ? "sales"
          : intent === "mark_department_service"
            ? "service"
            : "general";
      const res = await updateConversationDepartment(
        staff.dealership_id,
        conversationId,
        nextDepartment
      );
      if (!res.ok) {
        return { ok: false, error: res.error.message };
      }
      break;
    }
    case "mark_pipeline_qualified":
    case "mark_pipeline_appointment":
    case "mark_pipeline_sold":
    case "mark_pipeline_lost": {
      const outcomeMap: Record<string, PipelineOutcomeKey> = {
        mark_pipeline_qualified: "qualified",
        mark_pipeline_appointment: "appointment",
        mark_pipeline_sold: "sold",
        mark_pipeline_lost: "lost",
      };
      const outcome = outcomeMap[intent];
      const res = await setConversationPipelineOutcome({
        dealershipId: staff.dealership_id,
        conversationId,
        actorUserId: staff.id,
        outcome,
      });
      if (!res.ok) {
        return { ok: false, error: res.error.message };
      }
      if (outcome === "sold" || outcome === "lost") {
        const closed = await updateConversationStatus(
          staff.dealership_id,
          conversationId,
          "closed",
          staff.id,
          { reason: `staff_mark_${outcome}` }
        );
        if (!closed.ok && closed.error.code !== "VALIDATION") {
          return { ok: false, error: closed.error.message };
        }
      }
      break;
    }
    case "clear_pipeline_qualified":
    case "clear_pipeline_appointment":
    case "clear_pipeline_sold":
    case "clear_pipeline_lost": {
      const clearMap: Record<string, PipelineOutcomeKey> = {
        clear_pipeline_qualified: "qualified",
        clear_pipeline_appointment: "appointment",
        clear_pipeline_sold: "sold",
        clear_pipeline_lost: "lost",
      };
      const outcome = clearMap[intent];
      const res = await clearConversationPipelineOutcome({
        dealershipId: staff.dealership_id,
        conversationId,
        actorUserId: staff.id,
        outcome,
      });
      if (!res.ok) {
        return { ok: false, error: res.error.message };
      }
      break;
    }
    default:
      return { ok: false, error: "Unknown action." };
  }

  revalidatePath("/inbox", "page");
  revalidatePath("/overview", "page");
  return { ok: true, error: null };
}
