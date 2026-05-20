export type OpportunityScoreBand = "high" | "medium" | "low";

export type OpportunitySignalId =
  | "financing"
  | "returning_visitor"
  | "appointment"
  | "timeline"
  | "trade";

export type OpportunitySignal = {
  id: OpportunitySignalId;
  label: string;
  active: boolean;
};

/** Persisted on `conversations.metadata.opportunity` and shown on inbox cards. */
export type OpportunitySnapshot = {
  score: number;
  intent_summary: string;
  confidence_pct: number;
  signals: OpportunitySignal[];
  updated_at: string;
};
