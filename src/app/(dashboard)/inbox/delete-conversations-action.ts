"use server";

import { revalidatePath } from "next/cache";

import { createSupabaseAdminClient } from "@/integrations/supabase/admin";
import { requireStaff } from "@/server/auth/staff";
import { deleteConversationsPermanently } from "@/server/data/delete-conversations";

export type DeleteConversationsActionState = {
  ok: boolean;
  error: string | null;
  deletedCount: number;
};

export const deleteConversationsInitialState: DeleteConversationsActionState = {
  ok: false,
  error: null,
  deletedCount: 0,
};

function parseConversationIds(raw: FormDataEntryValue | null): string[] {
  if (typeof raw !== "string" || !raw.trim()) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((id): id is string => typeof id === "string");
  } catch {
    return [];
  }
}

export async function deleteConversationsForeverAction(
  _prev: DeleteConversationsActionState,
  formData: FormData
): Promise<DeleteConversationsActionState> {
  const staff = await requireStaff();

  const ids = parseConversationIds(formData.get("conversationIds"));
  const res = await deleteConversationsPermanently(
    staff.dealership_id,
    ids,
    createSupabaseAdminClient()
  );

  if (!res.ok) {
    return {
      ok: false,
      error: res.error.message,
      deletedCount: 0,
    };
  }

  if (res.data.deletedCount === 0) {
    return {
      ok: false,
      error: "No conversations were deleted. They may already be removed.",
      deletedCount: 0,
    };
  }

  revalidatePath("/inbox", "page");
  revalidatePath("/overview", "page");

  return {
    ok: true,
    error: null,
    deletedCount: res.data.deletedCount,
  };
}
