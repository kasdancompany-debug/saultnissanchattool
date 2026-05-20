import "server-only";

import type {
  ConversationPriority,
  Sentiment,
} from "@/integrations/supabase/database.types";
import { analyzeInboundEscalationHeuristic } from "@/lib/sentiment/inbound-escalation-heuristic";
import type { Json } from "@/integrations/supabase/database.types";
import { insertConversationEvent } from "@/server/data/conversation-events";
import { fromPostgrestError } from "@/server/data/postgrest-error";
import type { TypedSupabaseClient } from "@/server/db/server-client";
import { notifySentimentEscalationAlert } from "@/server/alerts/sentiment-escalation-alerts";
import { err, ok, type Result } from "@/server/result";

const AI_NEGATIVE_MIN_CONFIDENCE = 0.4;

function nextPriority(current: ConversationPriority): ConversationPriority {
  if (current === "urgent" || current === "high") {
    return current;
  }
  return "high";
}

function mergeMetadata(
  existing: Json,
  patch: Record<string, unknown>
): Json {
  const base =
    existing &&
    typeof existing === "object" &&
    !Array.isArray(existing) &&
    existing !== null
      ? (existing as Record<string, unknown>)
      : {};
  return { ...base, ...patch } as Json;
}

export type AiSentimentSnapshot = {
  sentiment: string;
  confidence: number;
};

/**
 * Flags the conversation (priority + metadata), writes a `sentiment_escalation`
 * event once per message, and invokes the alerting hook. Safe to call after
 * every inbound customer message; duplicates for the same message_id are skipped.
 */
export async function applySentimentEscalation(input: {
  supabase: TypedSupabaseClient;
  dealershipId: string;
  conversationId: string;
  messageId: string;
  inboundBody: string;
  /** When null (AI off or failed), only keyword heuristics apply. */
  ai: AiSentimentSnapshot | null;
}): Promise<Result<void>> {
  const heuristic = analyzeInboundEscalationHeuristic(input.inboundBody);

  const aiNegative =
    input.ai != null &&
    input.ai.sentiment === "negative" &&
    input.ai.confidence >= AI_NEGATIVE_MIN_CONFIDENCE;

  const shouldFlag = heuristic.shouldEscalate || aiNegative;

  if (!shouldFlag) {
    return ok(undefined);
  }

  const sources: ("ai_negative" | "keyword_heuristic")[] = [];
  if (heuristic.shouldEscalate) {
    sources.push("keyword_heuristic");
  }
  if (aiNegative) {
    sources.push("ai_negative");
  }

  const dedupe = await input.supabase
    .from("conversation_events")
    .select("id")
    .eq("conversation_id", input.conversationId)
    .eq("event_type", "sentiment_escalation")
    .filter("payload->>message_id", "eq", input.messageId)
    .maybeSingle();

  if (dedupe.error) {
    return fromPostgrestError(dedupe.error);
  }
  if (dedupe.data) {
    return ok(undefined);
  }

  const conv = await input.supabase
    .from("conversations")
    .select("id, priority, sentiment, metadata")
    .eq("dealership_id", input.dealershipId)
    .eq("id", input.conversationId)
    .maybeSingle();

  if (conv.error) {
    return fromPostgrestError(conv.error);
  }
  if (!conv.data) {
    return err("NOT_FOUND", "Conversation not found");
  }

  const now = new Date().toISOString();
  const nextSentiment: Sentiment = aiNegative
    ? "negative"
    : (conv.data.sentiment as Sentiment);

  const metaPatch = {
    sentiment_escalation: {
      active: true,
      flagged_at: now,
      last_message_id: input.messageId,
      sources,
      keyword_hits: heuristic.hits,
    },
  };

  const updated = await input.supabase
    .from("conversations")
    .update({
      priority: nextPriority(conv.data.priority as ConversationPriority),
      sentiment: nextSentiment,
      metadata: mergeMetadata(conv.data.metadata as Json, metaPatch),
      updated_at: now,
    })
    .eq("dealership_id", input.dealershipId)
    .eq("id", input.conversationId);

  if (updated.error) {
    return fromPostgrestError(updated.error);
  }

  const ev = await insertConversationEvent(input.supabase, {
    conversation_id: input.conversationId,
    event_type: "sentiment_escalation",
    actor_user_id: null,
    payload: {
      message_id: input.messageId,
      sources,
      keyword_hits: heuristic.hits,
      ai_negative: aiNegative,
      ai_confidence: input.ai?.confidence ?? null,
    },
  });

  if (!ev.ok) {
    return ev;
  }

  notifySentimentEscalationAlert({
    dealershipId: input.dealershipId,
    conversationId: input.conversationId,
    messageId: input.messageId,
    sources,
    occurredAt: now,
  });

  return ok(undefined);
}
