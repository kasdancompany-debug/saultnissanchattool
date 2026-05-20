/**
 * Conservative keyword / phrase signals for escalation risk when AI output is
 * missing or disagrees with obvious phrasing. Tuned to limit false positives:
 * single mild negatives (e.g. "not great") do not fire; legal/manager/strong
 * language or multiple strong frustration signals do.
 */

export type InboundEscalationHeuristicResult = {
  shouldEscalate: boolean;
  /** Human-readable labels for logging / payloads */
  hits: string[];
};

const STRONG_PATTERNS: { label: string; re: RegExp }[] = [
  { label: "legal_threat", re: /\b(lawsuit|sue|suing|attorney|lawyer|legal action)\b/i },
  { label: "bbb", re: /\b(better business bureau|\bbbb\b)\b/i },
  { label: "fraud_scam", re: /\b(fraud|scam|rip[\s-]?off)\b/i },
  { label: "report_authority", re: /\b(report you|reporting you|file a complaint)\b/i },
  {
    label: "manager_escalation",
    re: /\b(speak to (a |the )?manager|talk to (a |the )?manager|demand(?:ing)? (a |the )?manager|get me (your |a )?supervisor|escalate (this|to))\b/i,
  },
  { label: "owner_corporate", re: /\b(owner|corporate office|head office|district manager)\b/i },
  {
    label: "never_again",
    re: /\b(never (buy|purchase|deal|coming) again|taking my business elsewhere)\b/i,
  },
];

/** Need at least two distinct medium hits (reduces single-word false positives). */
const MEDIUM_PATTERNS: { label: string; re: RegExp }[] = [
  { label: "strong_frustration", re: /\b(unacceptable|disgusted|outraged|furious|infuriated)\b/i },
  { label: "service_failure", re: /\b(terrible service|horrible service|worst experience|absolutely terrible)\b/i },
  { label: "demand_resolution", re: /\b(this is ridiculous|enough is enough|completely unacceptable)\b/i },
  { label: "refund_anger", re: /\b(demand(?:ing)? (a |my )?refund|want my money back|full refund now)\b/i },
];

function normalize(text: string): string {
  return text.trim().replace(/\s+/g, " ");
}

/**
 * Returns whether deterministic rules suggest escalation for this inbound body.
 */
export function analyzeInboundEscalationHeuristic(
  rawBody: string
): InboundEscalationHeuristicResult {
  const body = normalize(rawBody);
  if (body.length < 4) {
    return { shouldEscalate: false, hits: [] };
  }

  const lower = body.toLowerCase();
  const strongHits: string[] = [];
  for (const { label, re } of STRONG_PATTERNS) {
    if (re.test(lower)) {
      strongHits.push(label);
    }
  }
  if (strongHits.length > 0) {
    return { shouldEscalate: true, hits: strongHits };
  }

  const mediumHits: string[] = [];
  for (const { label, re } of MEDIUM_PATTERNS) {
    if (re.test(lower)) {
      mediumHits.push(label);
    }
  }

  if (mediumHits.length >= 2) {
    return { shouldEscalate: true, hits: mediumHits };
  }

  return { shouldEscalate: false, hits: mediumHits };
}
