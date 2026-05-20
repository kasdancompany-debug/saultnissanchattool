import "server-only";

import type {
  ConversationStatus,
  Json,
} from "@/integrations/supabase/database.types";
import {
  aiLeadAutoReplyControlPatch,
  getConversationResponseModeForUi,
  humanManualOnlyControlPatch,
  isConversationHumanControlled,
  mergeConversationControl,
} from "@/lib/conversation/control-metadata";
import { claimConversation } from "@/server/data/conversation-workflow";
import { getConversationRowById } from "@/server/data/conversations";
import { insertConversationEvent } from "@/server/data/conversation-events";
import { resolveDb } from "@/server/data/internal";
import type { TypedSupabaseClient } from "@/server/db/server-client";
import { err, ok, type Result } from "@/server/result";

const TERMINAL: ConversationStatus[] = ["closed", "archived", "spam"];

async function logResponseModeChange(
  supabase: TypedSupabaseClient,
  conversationId: string,
  staffUserId: string,
  payload: Record<string, unknown>
): Promise<Result<void>> {
  return insertConversationEvent(supabase, {
    conversation_id: conversationId,
    event_type: "metadata_changed",
    actor_user_id: staffUserId,
    payload: payload as Json,
  });
}

/**
 * Sets inbox response mode: AI-led (automated replies where allowed) vs human-led (manual only).
 * Human mode may call {@link claimConversation} so staff get instant takeover when needed.
 */
export async function setConversationResponseMode(input: {
  dealershipId: string;
  conversationId: string;
  staffUserId: string;
  nextMode: "ai" | "human";
}): Promise<Result<void>> {
  const dealershipId = input.dealershipId?.trim();
  const conversationId = input.conversationId?.trim();
  const staffUserId = input.staffUserId?.trim();
  if (!dealershipId || !conversationId || !staffUserId) {
    return err("VALIDATION", "dealershipId, conversationId, and staffUserId are required.");
  }

  const supabase = await resolveDb();

  const convRes = await getConversationRowById(dealershipId, conversationId, supabase);
  if (!convRes.ok) {
    return err(convRes.error.code, convRes.error.message);
  }

  const conv = convRes.data;
  if (TERMINAL.includes(conv.status)) {
    return err("FORBIDDEN", "This conversation cannot be switched out of read-only state.");
  }

  const currentUiMode = getConversationResponseModeForUi(conv.metadata, conv.status);
  /** Human mode may still need a claim when UI already shows “human” (e.g. waiting queue or another owner). */
  const staffNeedsHumanClaim =
    input.nextMode === "human" &&
    (conv.assigned_to_user_id == null || conv.assigned_to_user_id !== staffUserId);

  if (input.nextMode === currentUiMode && !staffNeedsHumanClaim) {
    return ok(undefined);
  }

  const now = new Date().toISOString();

  if (input.nextMode === "human") {
    const needsClaim =
      conv.assigned_to_user_id == null || conv.assigned_to_user_id !== staffUserId;

    if (needsClaim) {
      const takeover =
        conv.assigned_to_user_id != null && conv.assigned_to_user_id !== staffUserId;
      const claimed = await claimConversation(
        {
          dealershipId,
          conversationId,
          staffUserId,
          takeover,
        },
        supabase
      );
      if (!claimed.ok) {
        return claimed;
      }
      return ok(undefined);
    }

    if (!isConversationHumanControlled(conv.metadata)) {
      const meta = mergeConversationControl(
        conv.metadata,
        humanManualOnlyControlPatch(staffUserId)
      );
      const upd = await supabase
        .from("conversations")
        .update({ metadata: meta, updated_at: now })
        .eq("dealership_id", dealershipId)
        .eq("id", conversationId);
      if (upd.error) {
        return err("DATABASE_ERROR", upd.error.message);
      }
      const logRes = await logResponseModeChange(supabase, conversationId, staffUserId, {
        reason: "staff_response_mode",
        next_mode: "human",
        previous_mode: "ai",
        path: "metadata_human_led",
      });
      if (!logRes.ok) {
        return logRes;
      }
    }

    return ok(undefined);
  }

  if (conv.status === "waiting_for_human") {
    return err(
      "FORBIDDEN",
      "This thread is waiting for a teammate. Claim it (or clear the queue) before enabling AI replies."
    );
  }
  if (conv.assigned_to_user_id && conv.assigned_to_user_id !== staffUserId) {
    return err(
      "FORBIDDEN",
      "Only the conversation owner can switch this thread back to AI mode."
    );
  }

  const meta = mergeConversationControl(conv.metadata, {
    ...aiLeadAutoReplyControlPatch(),
    claimed_by: null,
    claimed_at: null,
  });

  const shouldEnableAi = conv.ai_enabled !== true;
  const upd = await supabase
    .from("conversations")
    .update({
      metadata: meta,
      ai_enabled: shouldEnableAi ? true : conv.ai_enabled,
      updated_at: now,
    })
    .eq("dealership_id", dealershipId)
    .eq("id", conversationId);

  if (upd.error) {
    return err("DATABASE_ERROR", upd.error.message);
  }

  return logResponseModeChange(supabase, conversationId, staffUserId, {
    reason: "staff_response_mode",
    next_mode: "ai",
    previous_mode: "human",
    path: "metadata_ai_led",
    ai_enabled_before: conv.ai_enabled,
    ai_enabled_after: true,
  });
}
