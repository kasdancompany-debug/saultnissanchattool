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
  staffEscalateConversation,
  unassignConversation,
} from "@/server/data/conversation-workflow";
import type { AppointmentDepartment } from "@/integrations/supabase/database.types";
import {
  combineDateAndTimeToIso,
  parseDatetimeLocalToIso,
} from "@/lib/appointments/format-datetime";
import {
  cancelAppointment,
  createAppointmentFromConversation,
  markAppointmentCompleted,
  markNoShow,
  saveConfirmedAppointmentFromConversation,
  updateAppointmentDetails,
} from "@/server/appointments";
import { staffCanEditDealershipSettings } from "@/server/settings/staff-privilege";
import type { InboxConversationActionState } from "./conversation-action-states";

function parseOptionalDatetimeField(formData: FormData, key: string): string | null {
  const raw = String(formData.get(key) ?? "").trim();
  if (!raw) {
    return null;
  }
  return parseDatetimeLocalToIso(raw);
}

function parseDepartmentField(formData: FormData): AppointmentDepartment | null {
  const raw = String(formData.get("department") ?? "").trim();
  if (raw === "sales" || raw === "service") {
    return raw;
  }
  return null;
}

export async function inboxConversationAction(
  _prev: InboxConversationActionState,
  formData: FormData
): Promise<InboxConversationActionState> {
  const intent = String(formData.get("intent") ?? "");
  const conversationId = String(formData.get("conversationId") ?? "").trim();

  if (!conversationId) {
    return { ok: false, error: "Missing conversation.", message: null };
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
        return { ok: false, error: res.error.message, message: null };
      }
      break;
    }
    case "reassign": {
      if (!canManageAssignments) {
        return {
          ok: false,
          error:
            "Only managers and admins can reassign customer ownership.",
          message: null,
        };
      }
      const assignToUserId = String(formData.get("assignToUserId") ?? "").trim();
      if (!assignToUserId) {
        return { ok: false, error: "Choose a teammate to assign.", message: null };
      }
      const res = await reassignConversation({
        dealershipId: staff.dealership_id,
        conversationId,
        assignToUserId,
        actorUserId: staff.id,
      });
      if (!res.ok) {
        return { ok: false, error: res.error.message, message: null };
      }
      break;
    }
    case "unassign": {
      if (!canManageAssignments) {
        return {
          ok: false,
          error: "Only managers and admins can move a customer back to unassigned.",
          message: null,
        };
      }
      const res = await unassignConversation({
        dealershipId: staff.dealership_id,
        conversationId,
        actorUserId: staff.id,
        actorRole: staff.role,
      });
      if (!res.ok) {
        return { ok: false, error: res.error.message, message: null };
      }
      break;
    }
    case "escalate": {
      const res = await staffEscalateConversation({
        dealershipId: staff.dealership_id,
        conversationId,
        actorUserId: staff.id,
        reason: "staff_escalate_copilot",
      });
      if (!res.ok) {
        return { ok: false, error: res.error.message, message: null };
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
        return { ok: false, error: res.error.message, message: null };
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
        return { ok: false, error: res.error.message, message: null };
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
        return { ok: false, error: res.error.message, message: null };
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
        return { ok: false, error: res.error.message, message: null };
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
          return { ok: false, error: closed.error.message, message: null };
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
        return { ok: false, error: res.error.message, message: null };
      }
      break;
    }
    case "appointment_create": {
      const department = parseDepartmentField(formData);
      if (!department) {
        return { ok: false, error: "Choose sales or service.", message: null };
      }
      const res = await createAppointmentFromConversation({
        dealershipId: staff.dealership_id,
        conversationId,
        actorUserId: staff.id,
        department,
        proposedDatetime: parseOptionalDatetimeField(formData, "proposedDatetime"),
        notes: String(formData.get("notes") ?? ""),
        source:
          String(formData.get("source") ?? "").trim() === "ai_detected"
            ? "ai_detected"
            : "manual",
      });
      if (!res.ok) {
        return { ok: false, error: res.error.message, message: null };
      }
      break;
    }
    case "appointment_confirm_save": {
      const department = parseDepartmentField(formData);
      if (!department) {
        return { ok: false, error: "Choose sales or service.", message: null };
      }
      const confirmedIso = combineDateAndTimeToIso(
        String(formData.get("confirmedDate") ?? ""),
        String(formData.get("confirmedTime") ?? "")
      );
      if (!confirmedIso) {
        return {
          ok: false,
          error: "Enter a valid confirmed date and time.",
          message: null,
        };
      }
      const appointmentId = String(formData.get("appointmentId") ?? "").trim();
      const assignedRaw = String(formData.get("assignedUserId") ?? "").trim();
      const res = await saveConfirmedAppointmentFromConversation({
        dealershipId: staff.dealership_id,
        conversationId,
        actorUserId: staff.id,
        appointmentId: appointmentId.length > 0 ? appointmentId : null,
        department,
        confirmedDatetime: confirmedIso,
        assignedUserId: assignedRaw.length > 0 ? assignedRaw : null,
        vehicleInterest: String(formData.get("vehicleInterest") ?? ""),
        notes: String(formData.get("notes") ?? ""),
        source: "manual",
      });
      if (!res.ok) {
        return { ok: false, error: res.error.message, message: null };
      }
      break;
    }
    case "appointment_edit": {
      const appointmentId = String(formData.get("appointmentId") ?? "").trim();
      if (!appointmentId) {
        return { ok: false, error: "Missing appointment.", message: null };
      }
      const department = parseDepartmentField(formData);
      const assignedRaw = String(formData.get("assignedUserId") ?? "").trim();
      const res = await updateAppointmentDetails({
        dealershipId: staff.dealership_id,
        appointmentId,
        actorUserId: staff.id,
        patch: {
          ...(department ? { department } : {}),
          proposedDatetime: parseOptionalDatetimeField(formData, "proposedDatetime"),
          confirmedDatetime: parseOptionalDatetimeField(formData, "confirmedDatetime"),
          assignedUserId: assignedRaw.length > 0 ? assignedRaw : null,
          notes: String(formData.get("notes") ?? ""),
        },
      });
      if (!res.ok) {
        return { ok: false, error: res.error.message, message: null };
      }
      break;
    }
    case "appointment_complete": {
      const appointmentId = String(formData.get("appointmentId") ?? "").trim();
      if (!appointmentId) {
        return { ok: false, error: "Missing appointment.", message: null };
      }
      const res = await markAppointmentCompleted({
        dealershipId: staff.dealership_id,
        appointmentId,
        actorUserId: staff.id,
      });
      if (!res.ok) {
        return { ok: false, error: res.error.message, message: null };
      }
      break;
    }
    case "appointment_no_show": {
      const appointmentId = String(formData.get("appointmentId") ?? "").trim();
      if (!appointmentId) {
        return { ok: false, error: "Missing appointment.", message: null };
      }
      const res = await markNoShow({
        dealershipId: staff.dealership_id,
        appointmentId,
        actorUserId: staff.id,
      });
      if (!res.ok) {
        return { ok: false, error: res.error.message, message: null };
      }
      break;
    }
    case "appointment_cancel": {
      const appointmentId = String(formData.get("appointmentId") ?? "").trim();
      if (!appointmentId) {
        return { ok: false, error: "Missing appointment.", message: null };
      }
      const res = await cancelAppointment({
        dealershipId: staff.dealership_id,
        appointmentId,
        actorUserId: staff.id,
      });
      if (!res.ok) {
        return { ok: false, error: res.error.message, message: null };
      }
      break;
    }
    default:
      return { ok: false, error: "Unknown action.", message: null };
  }

  revalidatePath("/inbox", "page");
  revalidatePath("/overview", "page");

  const appointmentMessages: Record<string, string> = {
    appointment_create: "Appointment created.",
    appointment_confirm_save:
      "Appointment confirmed — saved to thread, pipeline, and timeline.",
    appointment_edit: "Appointment updated.",
    appointment_complete: "Marked as completed.",
    appointment_no_show: "Marked as no show.",
    appointment_cancel: "Appointment cancelled.",
  };

  return {
    ok: true,
    error: null,
    message:
      intent === "escalate"
        ? "Escalated — thread is in Needs human. AI autopilot is paused; reply when you're ready."
        : appointmentMessages[intent] ?? null,
  };
}
