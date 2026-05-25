"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  buildInboxHref,
  parseInboxFilter,
  parseInboxOwnerUserId,
} from "@/components/inbox/inbox-params";
import { parseInboxSort } from "@/lib/inbox/inbox-sort";
import { createSupabaseAdminClient, hasSupabaseServiceRoleKey } from "@/integrations/supabase/admin";
import { createSupabaseServerClient } from "@/integrations/supabase/server";
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

function parseDeleteReturnHref(formData: FormData): string {
  const filter = parseInboxFilter(
    typeof formData.get("filter") === "string"
      ? (formData.get("filter") as string)
      : undefined
  );
  const sort = parseInboxSort(
    typeof formData.get("sort") === "string"
      ? (formData.get("sort") as string)
      : undefined
  );
  const ownerUserId = parseInboxOwnerUserId(formData.get("assigneeScopeUserId"));
  return buildInboxHref(filter, {
    ownerUserId,
    sort,
    conversationId: null,
  });
}

function deleteSetupErrorMessage(): string {
  return (
    "Permanent delete is not fully set up on the database yet. In Supabase → SQL Editor, run the migration file supabase/migrations/20260521120000_staff_delete_conversations.sql, then try again. Also add SUPABASE_SERVICE_ROLE_KEY in Vercel if deletes still fail."
  );
}

export async function deleteConversationsForeverAction(
  _prev: DeleteConversationsActionState,
  formData: FormData
): Promise<DeleteConversationsActionState> {
  const returnHref = parseDeleteReturnHref(formData);

  try {
    const staff = await requireStaff();
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
          createSupabaseAdminClient()
        );
      }
    }

    if (!res.ok) {
      const message =
        res.error.code === "FORBIDDEN" ||
        res.error.message.toLowerCase().includes("policy")
          ? deleteSetupErrorMessage()
          : res.error.message;
      return {
        ok: false,
        error: message,
        deletedCount: 0,
      };
    }

    if (res.data.deletedCount === 0) {
      return {
        ok: false,
        error: deleteSetupErrorMessage(),
        deletedCount: 0,
      };
    }

    revalidatePath("/inbox", "page");
    revalidatePath("/overview", "page");
    redirect(returnHref);
  } catch (e) {
    if (
      e &&
      typeof e === "object" &&
      "digest" in e &&
      String((e as { digest?: string }).digest ?? "").startsWith("NEXT_REDIRECT")
    ) {
      throw e;
    }

    const message =
      e instanceof Error ? e.message : "Could not delete conversations.";
    if (message.includes("SUPABASE_SERVICE_ROLE_KEY")) {
      return {
        ok: false,
        error: deleteSetupErrorMessage(),
        deletedCount: 0,
      };
    }

    return {
      ok: false,
      error: message,
      deletedCount: 0,
    };
  }
}
