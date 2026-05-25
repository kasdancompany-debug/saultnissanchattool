import { NextResponse } from "next/server";

import { createSupabaseAdminClient, hasSupabaseServiceRoleKey } from "@/integrations/supabase/admin";
import { createSupabaseServerClient } from "@/integrations/supabase/server";
import { getCurrentStaff } from "@/server/auth/staff";
import { deleteConversationsPermanently } from "@/server/data/delete-conversations";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const staff = await getCurrentStaff();
  if (!staff) {
    return NextResponse.json(
      { ok: false, error: "Your session expired. Sign in again.", deletedCount: 0 },
      { status: 401 }
    );
  }

  let conversationIds: string[] = [];
  try {
    const body = (await request.json()) as { conversationIds?: unknown };
    if (Array.isArray(body.conversationIds)) {
      conversationIds = body.conversationIds.filter(
        (id): id is string => typeof id === "string"
      );
    }
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid request body.", deletedCount: 0 },
      { status: 400 }
    );
  }

  const sessionDb = await createSupabaseServerClient();
  let res = await deleteConversationsPermanently(
    staff.dealership_id,
    conversationIds,
    sessionDb
  );

  if (
    (!res.ok &&
      (res.error.code === "FORBIDDEN" ||
        res.error.message.toLowerCase().includes("policy"))) ||
    (res.ok && res.data.deletedCount === 0 && conversationIds.length > 0)
  ) {
    if (hasSupabaseServiceRoleKey()) {
      res = await deleteConversationsPermanently(
        staff.dealership_id,
        conversationIds,
        createSupabaseAdminClient(),
        { preferTableDelete: true }
      );
    }
  }

  if (!res.ok) {
    return NextResponse.json(
      { ok: false, error: res.error.message, deletedCount: 0 },
      { status: 400 }
    );
  }

  if (res.data.deletedCount === 0) {
    return NextResponse.json(
      {
        ok: false,
        error: "No conversations were deleted. Refresh and try again.",
        deletedCount: 0,
      },
      { status: 400 }
    );
  }

  return NextResponse.json({
    ok: true,
    error: null,
    deletedCount: res.data.deletedCount,
  });
}
