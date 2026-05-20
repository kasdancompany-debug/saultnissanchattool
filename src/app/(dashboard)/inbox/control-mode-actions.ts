"use server";

import { revalidatePath } from "next/cache";

import { requireStaff } from "@/server/auth/staff";
import { setConversationResponseMode } from "@/server/messaging/set-conversation-response-mode";
import type { ConversationControlModeActionState } from "./conversation-action-states";

export async function setConversationControlModeAction(
  _prev: ConversationControlModeActionState,
  formData: FormData
): Promise<ConversationControlModeActionState> {
  const conversationId = String(formData.get("conversationId") ?? "").trim();
  const modeRaw = String(formData.get("mode") ?? "").trim();

  if (!conversationId) {
    return { ok: false, error: "Missing conversation." };
  }
  if (modeRaw !== "ai" && modeRaw !== "human") {
    return { ok: false, error: "Invalid mode." };
  }

  const staff = await requireStaff();
  const res = await setConversationResponseMode({
    dealershipId: staff.dealership_id,
    conversationId,
    staffUserId: staff.id,
    nextMode: modeRaw,
  });

  if (!res.ok) {
    return { ok: false, error: res.error.message };
  }

  revalidatePath("/inbox", "page");
  return { ok: true, error: null };
}
