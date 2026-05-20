import type { Json, StaffDepartment } from "@/integrations/supabase/database.types";
import type { InboundClassificationModelOutput } from "@/server/ai/schemas/inbound-classification";
import type { OpportunityScoreBand } from "@/lib/opportunity/types";
import { opportunityScoreBand } from "@/lib/opportunity/score-band";

export type ConversationAiInsights = {
  intent: string;
  department: StaffDepartment;
  urgency: string;
  sentiment: string;
  confidence: number;
  /** Derived from opportunity score band — high / medium / low purchase intent. */
  intent_level: OpportunityScoreBand;
  opportunity_score: number;
  recommended_action: string;
  customer_profile: {
    name: string | null;
    email: string | null;
    phone_e164: string | null;
  };
  missing_profile_fields: string[];
  updated_at: string;
};

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function isAiInsights(value: unknown): value is ConversationAiInsights {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const o = value as Record<string, unknown>;
  return (
    typeof o.intent === "string" &&
    typeof o.department === "string" &&
    typeof o.intent_level === "string" &&
    typeof o.opportunity_score === "number"
  );
}

export function readAiInsightsFromMetadata(
  metadata: unknown
): ConversationAiInsights | null {
  const raw = asRecord(metadata).ai_insights;
  if (!isAiInsights(raw)) return null;
  return raw;
}

export function buildAiInsightsSnapshot(input: {
  classified: InboundClassificationModelOutput;
  opportunityScore: number;
  missingProfileFields: string[];
}): ConversationAiInsights {
  const score = Math.round(input.opportunityScore);
  return {
    intent: input.classified.intent,
    department: input.classified.department,
    urgency: input.classified.urgency,
    sentiment: input.classified.sentiment,
    confidence: input.classified.confidence,
    intent_level: opportunityScoreBand(score),
    opportunity_score: score,
    recommended_action: input.classified.recommended_action,
    customer_profile: {
      name: input.classified.customer_profile.name,
      email: input.classified.customer_profile.email,
      phone_e164: input.classified.customer_profile.phone_e164,
    },
    missing_profile_fields: input.missingProfileFields,
    updated_at: new Date().toISOString(),
  };
}

export function mergeAiInsightsMetadata(
  previous: Json,
  insights: ConversationAiInsights
): Json {
  const base = asRecord(previous);
  return {
    ...base,
    ai_insights: insights,
  } as Json;
}
