import "server-only";

import type { Json } from "@/integrations/supabase/database.types";
import {
  clearPipelineOutcome,
  mergePipelineOutcome,
  type PipelineOutcomeKey,
} from "@/lib/conversation/pipeline-outcomes";
import { getConversationRowById } from "@/server/data/conversations";
import { insertConversationEvent } from "@/server/data/conversation-events";
import type { TypedSupabaseClient } from "@/server/db/server-client";
import { resolveDb } from "@/server/data/internal";
import { err, ok, type Result } from "@/server/result";
import type { ConversationRow } from "@/server/data/conversations";

export async function setConversationPipelineOutcome(
  input: {
    dealershipId: string;
    conversationId: string;
    actorUserId: string;
    outcome: PipelineOutcomeKey;
    note?: string | null;
  },
  db?: TypedSupabaseClient
): Promise<Result<ConversationRow>> {
  const supabase = await resolveDb(db);
  const conv = await getConversationRowById(
    input.dealershipId,
    input.conversationId,
    supabase
  );
  if (!conv.ok) {
    return conv;
  }

  const now = new Date().toISOString();
  const stamp = {
    at: now,
    by: input.actorUserId,
    note: input.note?.trim() || null,
  };

  const metadata = mergePipelineOutcome(
    conv.data.metadata as Json,
    input.outcome,
    stamp
  );

  const upd = await supabase
    .from("conversations")
    .update({ metadata, updated_at: now })
    .eq("dealership_id", input.dealershipId)
    .eq("id", input.conversationId)
    .select("*")
    .single();

  if (upd.error) {
    return err("DATABASE_ERROR", upd.error.message);
  }

  await insertConversationEvent(supabase, {
    conversation_id: input.conversationId,
    event_type: "metadata_changed",
    actor_user_id: input.actorUserId,
    payload: {
      kind: "pipeline_outcome_set",
      outcome: input.outcome,
      at: now,
    },
  });

  return ok(upd.data);
}

export async function clearConversationPipelineOutcome(
  input: {
    dealershipId: string;
    conversationId: string;
    actorUserId: string;
    outcome: PipelineOutcomeKey;
  },
  db?: TypedSupabaseClient
): Promise<Result<ConversationRow>> {
  const supabase = await resolveDb(db);
  const conv = await getConversationRowById(
    input.dealershipId,
    input.conversationId,
    supabase
  );
  if (!conv.ok) {
    return conv;
  }

  const now = new Date().toISOString();
  const metadata = clearPipelineOutcome(conv.data.metadata as Json, input.outcome);

  const upd = await supabase
    .from("conversations")
    .update({ metadata, updated_at: now })
    .eq("dealership_id", input.dealershipId)
    .eq("id", input.conversationId)
    .select("*")
    .single();

  if (upd.error) {
    return err("DATABASE_ERROR", upd.error.message);
  }

  await insertConversationEvent(supabase, {
    conversation_id: input.conversationId,
    event_type: "metadata_changed",
    actor_user_id: input.actorUserId,
    payload: {
      kind: "pipeline_outcome_cleared",
      outcome: input.outcome,
      at: now,
    },
  });

  return ok(upd.data);
}
