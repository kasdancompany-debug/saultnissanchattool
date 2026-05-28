"use server";

import { revalidatePath } from "next/cache";

import { requireStaff } from "@/server/auth/staff";
import { insertServiceSchedulerLinkForConversation } from "@/server/service-scheduler/service-scheduler-link";

export type ServiceSchedulerLinkActionResult = {
  ok: boolean;
  error: string | null;
  messageText?: string | null;
};

export async function insertServiceSchedulerLinkAction(
  conversationId: string
): Promise<ServiceSchedulerLinkActionResult> {
  const trimmedId = conversationId.trim();
  if (!trimmedId) {
    return { ok: false, error: "Missing conversation." };
  }

  const staff = await requireStaff();
  const res = await insertServiceSchedulerLinkForConversation(
    staff.dealership_id,
    trimmedId,
    staff.id
  );

  if (!res.ok) {
    return { ok: false, error: res.error.message };
  }

  revalidatePath("/inbox", "page");
  return {
    ok: true,
    error: null,
    messageText: res.data.messageText,
  };
}
