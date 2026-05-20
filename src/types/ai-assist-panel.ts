/**
 * Serializable view model for the inbox AI assist panel (built server-side).
 */
export type AiAssistPanelView = {
  promptVersion: string;
  model: string;
  intent: string;
  department: string;
  urgency: string;
  sentiment: string;
  confidence: number;
  recommendedAction: string;
  /** Model output before rule overrides (staff can see if rules forced escalation). */
  modelSuggestedEscalate: boolean;
  /** After low confidence, negative sentiment, draft safety, etc. */
  escalateEffective: boolean;
  rulesApplied: string[];
  safeDraftReply: string;
  /** Set when heuristic draft redaction replaced risky model text (audit). */
  draftRedaction: { redacted: boolean; triggers?: string[] } | null;
  runError: string | null;
  createdAt: string;
};
