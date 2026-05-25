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

function isAiInsightsShape(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const o = value as Record<string, unknown>;
  return (
    typeof o.intent === "string" &&
    typeof o.department === "string" &&
    typeof o.intent_level === "string" &&
    typeof o.opportunity_score === "number"
  );
}

function normalizeCustomerProfile(
  value: unknown
): ConversationAiInsights["customer_profile"] {
  const p = asRecord(value);
  return {
    name: typeof p.name === "string" ? p.name : null,
    email: typeof p.email === "string" ? p.email : null,
    phone_e164: typeof p.phone_e164 === "string" ? p.phone_e164 : null,
  };
}

function normalizeAiInsights(raw: Record<string, unknown>): ConversationAiInsights {
  const missing = Array.isArray(raw.missing_profile_fields)
    ? raw.missing_profile_fields.filter(
        (field): field is string => typeof field === "string"
      )
    : [];

  return {
    intent: String(raw.intent),
    department: raw.department as StaffDepartment,
    urgency: typeof raw.urgency === "string" ? raw.urgency : "normal",
    sentiment: typeof raw.sentiment === "string" ? raw.sentiment : "neutral",
    confidence:
      typeof raw.confidence === "number" && Number.isFinite(raw.confidence)
        ? raw.confidence
        : 0,
    intent_level: raw.intent_level as OpportunityScoreBand,
    opportunity_score:
      typeof raw.opportunity_score === "number" &&
      Number.isFinite(raw.opportunity_score)
        ? raw.opportunity_score
        : 0,
    recommended_action:
      typeof raw.recommended_action === "string"
        ? raw.recommended_action
        : "",
    customer_profile: normalizeCustomerProfile(raw.customer_profile),
    missing_profile_fields: missing,
    updated_at:
      typeof raw.updated_at === "string" ? raw.updated_at : new Date().toISOString(),
  };
}

export function readAiInsightsFromMetadata(
  metadata: unknown
): ConversationAiInsights | null {
  const raw = asRecord(metadata).ai_insights;
  if (!isAiInsightsShape(raw)) return null;
  return normalizeAiInsights(raw as Record<string, unknown>);
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
