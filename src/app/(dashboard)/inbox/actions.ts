"use server";

import { revalidatePath } from "next/cache";

import { requireStaff } from "@/server/auth/staff";
import { getConversationRowById } from "@/server/data/conversations";
import { getMessageByIdForConversation } from "@/server/data/messages";
import { sendStaffReply } from "@/server/messaging/send-staff-reply";
import { validateStaffMessageBody } from "@/server/messaging/validation/message-body";
import type { InboxReplyActionState } from "./action-states";

export async function sendInboxReplyAction(
  _prevState: InboxReplyActionState,
  formData: FormData
): Promise<InboxReplyActionState> {
  const conversationId = String(formData.get("conversationId") ?? "").trim();
  const rawBody = formData.get("body");

  if (!conversationId) {
    return { ok: false, error: "Missing conversation." };
  }

  const validated = validateStaffMessageBody(rawBody);
  if (!validated.ok) {
    return { ok: false, error: validated.error.message };
  }

  const staff = await requireStaff();

  // Channel-specific delivery (SMS → Twilio service, web → transport) lives in `sendStaffReply` — not here.
  const res = await sendStaffReply({
    dealershipId: staff.dealership_id,
    conversationId,
    staffUserId: staff.id,
    body: validated.data,
  });

  if (!res.ok) {
    return { ok: false, error: res.error.message };
  }

  revalidatePath("/inbox", "page");

  return { ok: true, error: null };
}

export async function retryFailedInboxMessageAction(
  _prevState: InboxReplyActionState,
  formData: FormData
): Promise<InboxReplyActionState> {
  const conversationId = String(formData.get("conversationId") ?? "").trim();
  const messageId = String(formData.get("messageId") ?? "").trim();
  if (!conversationId || !messageId) {
    return { ok: false, error: "Missing conversation or message." };
  }

  const staff = await requireStaff();
  const convRes = await getConversationRowById(
    staff.dealership_id,
    conversationId
  );
  if (!convRes.ok || convRes.data.channel !== "sms") {
    return {
      ok: false,
      error: "Only failed SMS replies can be retried from this view.",
    };
  }

  const msgRes = await getMessageByIdForConversation(
    staff.dealership_id,
    conversationId,
    messageId
  );
  if (!msgRes.ok) {
    return { ok: false, error: msgRes.error.message };
  }
  const message = msgRes.data;
  if (message.sender_type !== "staff" || message.delivery_status !== "failed") {
    return { ok: false, error: "This message is not eligible for retry." };
  }

  const retry = await sendStaffReply({
    dealershipId: staff.dealership_id,
    conversationId,
    staffUserId: staff.id,
    body: message.body,
  });
  if (!retry.ok) {
    return { ok: false, error: retry.error.message };
  }

  revalidatePath("/inbox", "page");
  return { ok: true, error: null };
}
