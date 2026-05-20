"use server";

import { revalidatePath } from "next/cache";

import { requireStaff } from "@/server/auth/staff";
import { updateConversationDepartment, updateConversationStatus } from "@/server/data/conversations";
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
    default:
      return { ok: false, error: "Unknown action." };
  }

  revalidatePath("/inbox", "page");
  return { ok: true, error: null };
}
