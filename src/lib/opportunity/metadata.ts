import type { Json } from "@/integrations/supabase/database.types";
import type { OpportunitySnapshot } from "@/lib/opportunity/types";

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function isOpportunitySnapshot(value: unknown): value is OpportunitySnapshot {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const o = value as Record<string, unknown>;
  return (
    typeof o.score === "number" &&
    Number.isFinite(o.score) &&
    typeof o.intent_summary === "string" &&
    typeof o.confidence_pct === "number" &&
    Number.isFinite(o.confidence_pct) &&
    Array.isArray(o.signals)
  );
}

export function readOpportunityFromMetadata(
  metadata: unknown
): OpportunitySnapshot | null {
  const raw = asRecord(metadata).opportunity;
  if (!isOpportunitySnapshot(raw)) return null;
  return raw;
}

export function mergeOpportunityMetadata(
  previous: Json,
  snapshot: OpportunitySnapshot
): Json {
  const base = asRecord(previous);
  return {
    ...base,
    opportunity: snapshot,
  } as Json;
}
