/**
 * Pluggable hook for notifying managers / on-call when a conversation is
 * flagged for sentiment or escalation risk. Wire email, Slack, or push here later.
 */

export type SentimentEscalationAlertPayload = {
  dealershipId: string;
  conversationId: string;
  messageId: string;
  sources: ("ai_negative" | "keyword_heuristic")[];
  occurredAt: string;
};

/**
 * No-op default — replace with real delivery (e.g. queue job, webhook to managers).
 */
export function notifySentimentEscalationAlert(
  payload: SentimentEscalationAlertPayload
): void {
  void payload;
  // Wire notifications for staff with role `manager` / `admin` here.
}
