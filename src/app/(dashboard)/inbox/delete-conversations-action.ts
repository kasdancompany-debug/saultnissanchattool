"use server";

import { createSupabaseAdminClient, hasSupabaseServiceRoleKey } from "@/integrations/supabase/admin";
import { createSupabaseServerClient } from "@/integrations/supabase/server";
import { getCurrentStaff } from "@/server/auth/staff";
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
  try {
    const staff = await getCurrentStaff();
    if (!staff) {
      return {
        ok: false,
        error: "Your session expired. Sign in again, then retry delete.",
        deletedCount: 0,
      };
    }

    const ids = parseConversationIds(formData.get("conversationIds"));
    const sessionDb = await createSupabaseServerClient();

    let res = await deleteConversationsPermanently(
      staff.dealership_id,
      ids,
      sessionDb
    );

    if (
      (!res.ok &&
        (res.error.code === "FORBIDDEN" ||
          res.error.message.toLowerCase().includes("policy"))) ||
      (res.ok && res.data.deletedCount === 0 && ids.length > 0)
    ) {
      if (hasSupabaseServiceRoleKey()) {
        res = await deleteConversationsPermanently(
          staff.dealership_id,
          ids,
          createSupabaseAdminClient(),
          { preferTableDelete: true }
        );
      }
    }

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
        error:
          "No conversations were deleted. Refresh the page and try again.",
        deletedCount: 0,
      };
    }

    return {
      ok: true,
      error: null,
      deletedCount: res.data.deletedCount,
    };
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Could not delete conversations.";
    return {
      ok: false,
      error: message,
      deletedCount: 0,
    };
  }
}
