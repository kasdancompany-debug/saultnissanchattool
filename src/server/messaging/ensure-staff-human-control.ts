import "server-only";

import {
  isConversationHumanControlled,
  mergeConversationControl,
} from "@/lib/conversation/control-metadata";
import { getConversationRowById } from "@/server/data/conversations";
import type { TypedSupabaseClient } from "@/server/db/server-client";
import { err, ok, type Result } from "@/server/result";

/**
 * Primary owner (or unassigned queue) may stamp human-led control on first staff reply.
 * Teammates who are not the assignee must use explicit takeover instead of side replies.
 */
export async function ensureStaffHumanControlOnReply(
  supabase: TypedSupabaseClient,
  dealershipId: string,
  conversationId: string,
  staffUserId: string
): Promise<Result<void>> {
  const convRes = await getConversationRowById(dealershipId, conversationId, supabase);
  if (!convRes.ok) {
    return err(convRes.error.code, convRes.error.message);
  }

  const conv = convRes.data;

  if (
    conv.assigned_to_user_id != null &&
    conv.assigned_to_user_id !== staffUserId
  ) {
    return ok(undefined);
  }

  if (isConversationHumanControlled(conv.metadata)) {
    return ok(undefined);
  }

  const now = new Date().toISOString();
  const meta = mergeConversationControl(conv.metadata, {
    mode: "human_led",
    handling_mode: "claimed_by_staff",
    ai_mode: "assist",
    ai_autopilot: false,
    claimed_by: staffUserId,
    claimed_at: now,
  });

  const patch: {
    assigned_to_user_id?: string;
    metadata: typeof meta;
    updated_at: string;
  } = {
    metadata: meta,
    updated_at: now,
  };

  if (!conv.assigned_to_user_id) {
    patch.assigned_to_user_id = staffUserId;
  }

  const upd = await supabase
    .from("conversations")
    .update(patch)
    .eq("dealership_id", dealershipId)
    .eq("id", conversationId);

  if (upd.error) {
    return err("DATABASE_ERROR", upd.error.message);
  }

  return ok(undefined);
}
