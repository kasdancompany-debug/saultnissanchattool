import type { OpportunityScoreBand } from "@/lib/opportunity/types";

export function clampOpportunityScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

/** Green 80–100, yellow 50–79, red 0–49. */
export function opportunityScoreBand(score: number): OpportunityScoreBand {
  const s = clampOpportunityScore(score);
  if (s >= 80) return "high";
  if (s >= 50) return "medium";
  return "low";
}

export function opportunityBandLabel(band: OpportunityScoreBand): string {
  if (band === "high") return "High opportunity";
  if (band === "medium") return "Moderate opportunity";
  return "Early stage";
}
