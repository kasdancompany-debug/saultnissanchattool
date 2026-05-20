import type { InboundClassificationModelOutput } from "@/server/ai/schemas/inbound-classification";

const SAFE_FALLBACK_REPLY =
  "Thanks for reaching out — a team member will review your message and follow up with accurate information. We appreciate your patience.";

/**
 * Heuristic scan for content that must not appear in customer-facing drafts
 * (payments, approvals, binding commitments). Does not replace legal review.
 */
const DRAFT_RISK_PATTERNS: Array<{ id: string; re: RegExp }> = [
  { id: "dollar_amount", re: /\$\s*[\d,]+(?:\.\d{2})?\b/ },
  { id: "payment_month", re: /\$\s*[\d,]+\s*\/\s*(?:mo|month)/i },
  { id: "apr_percent", re: /\b\d+(?:\.\d+)?\s*%\s*(?:apr|interest)\b/i },
  { id: "approval_promise", re: /\b(approved|pre-?approved|guaranteed\s+approval)\b/i },
  { id: "price_commitment", re: /\b(we\s+(?:can|will)\s+)?(?:match|beat)\b.*\b(price|payment)\b/i },
  { id: "payment_quote", re: /\b(?:per\s+month|\/mo|monthly\s+payment)\s+of\s+\$?\d/i },
  { id: "warranty_promise", re: /\b(?:full\s+)?warranty\s+(?:covers|guarantees)\b/i },
];

export type InboundDraftSafetyResult = {
  output: InboundClassificationModelOutput;
  redacted: boolean;
  /** Pattern ids that matched the original draft. */
  triggers: string[];
};

/**
 * If the model draft contains risky patterns, replace it with a neutral template,
 * force human escalation, and record triggers for audit.
 */
export function applyInboundDraftSafety(
  parsed: InboundClassificationModelOutput
): InboundDraftSafetyResult {
  const text = parsed.safe_draft_reply ?? "";
  const triggers: string[] = [];
  for (const { id, re } of DRAFT_RISK_PATTERNS) {
    re.lastIndex = 0;
    if (re.test(text)) {
      triggers.push(id);
    }
  }

  if (triggers.length === 0) {
    return { output: parsed, redacted: false, triggers: [] };
  }

  return {
    output: {
      ...parsed,
      safe_draft_reply: SAFE_FALLBACK_REPLY,
      escalate_to_human: true,
    },
    redacted: true,
    triggers,
  };
}
