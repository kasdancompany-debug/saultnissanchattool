/**
 * `conversations.metadata.sentiment_escalation` — set when escalation is applied.
 */

export type SentimentEscalationMetadata = {
  active: boolean;
  flagged_at: string;
  last_message_id: string;
  sources: ("ai_negative" | "keyword_heuristic")[];
  keyword_hits?: string[];
};

export function parseSentimentEscalationMetadata(
  metadata: unknown
): SentimentEscalationMetadata | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }
  const se = (metadata as { sentiment_escalation?: unknown }).sentiment_escalation;
  if (!se || typeof se !== "object" || Array.isArray(se)) {
    return null;
  }
  const o = se as Record<string, unknown>;
  if (o.active !== true) {
    return null;
  }
  if (typeof o.flagged_at !== "string" || typeof o.last_message_id !== "string") {
    return null;
  }
  if (!Array.isArray(o.sources)) {
    return null;
  }
  const sources = o.sources.filter(
    (s): s is "ai_negative" | "keyword_heuristic" =>
      s === "ai_negative" || s === "keyword_heuristic"
  );
  return {
    active: true,
    flagged_at: o.flagged_at,
    last_message_id: o.last_message_id,
    sources,
  };
}

export function isSentimentEscalationActive(metadata: unknown): boolean {
  return parseSentimentEscalationMetadata(metadata) !== null;
}
