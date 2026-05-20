import type {
  ConversationStatus,
  StaffDepartment,
} from "@/integrations/supabase/database.types";
import { clampOpportunityScore } from "@/lib/opportunity/score-band";
import type {
  OpportunitySignal,
  OpportunitySignalId,
  OpportunitySnapshot,
} from "@/lib/opportunity/types";

const FINANCING_RE =
  /\b(financ(?:e|ing)|pre[- ]?approved|apr|lease|monthly payment|payment|credit|loan)\b/i;
const APPOINTMENT_RE =
  /\b(appointment|book(?:ing)?|schedule|test drive|come in|visit|stop by)\b/i;
const TIMELINE_RE =
  /\b(today|tonight|tomorrow|this week|asap|right away|soon|timeline|by (?:mon|tue|wed|thu|fri|saturday|sunday))\b/i;
const TRADE_RE = /\b(trade(?:-|\s)?in|trade value|instant trade|appraisal|sell my)\b/i;

const SIGNAL_DEFS: { id: OpportunitySignalId; label: string; re: RegExp }[] = [
  { id: "financing", label: "Mentioned financing", re: FINANCING_RE },
  { id: "returning_visitor", label: "Returning visitor", re: /^$/ }, // special
  { id: "appointment", label: "Wants appointment", re: APPOINTMENT_RE },
  { id: "timeline", label: "Mentioned timeline", re: TIMELINE_RE },
  { id: "trade", label: "Trade available", re: TRADE_RE },
];

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function detectReturningVisitor(
  conversationMetadata: unknown,
  customerMetadata: unknown
): boolean {
  const conv = asRecord(conversationMetadata);
  if (conv.lead_capture) return true;

  const widget = asRecord(conv.widget);
  if (widget.returning_visitor === true) return true;

  const cust = asRecord(customerMetadata);
  if (cust.returning === true) return true;
  const visits = cust.visit_count;
  if (typeof visits === "number" && visits > 1) return true;

  return false;
}

function buildSignals(
  text: string,
  conversationMetadata: unknown,
  customerMetadata: unknown
): OpportunitySignal[] {
  const normalized = text.toLowerCase();
  const returning = detectReturningVisitor(conversationMetadata, customerMetadata);

  return SIGNAL_DEFS.map((def) => {
    if (def.id === "returning_visitor") {
      return { id: def.id, label: def.label, active: returning };
    }
    return {
      id: def.id,
      label: def.label,
      active: def.re.test(normalized),
    };
  });
}

function intentSummaryForScore(
  score: number,
  department: StaffDepartment,
  activeCount: number
): string {
  if (score >= 80) {
    if (department === "service") return "Ready to book service";
    if (activeCount >= 3) return "High purchase intent";
    return "Strong buying signals";
  }
  if (score >= 50) return "Moderate interest";
  return "Early exploration";
}

export type ComputeOpportunityInput = {
  messageText: string;
  classification?: {
    intent: string;
    confidence: number;
    urgency: string;
    sentiment?: string;
  } | null;
  conversationMetadata: unknown;
  customerMetadata?: unknown;
  status: ConversationStatus;
  department: StaffDepartment;
};

export function computeOpportunityScore(
  input: ComputeOpportunityInput
): OpportunitySnapshot {
  const combined = [
    input.messageText,
    input.classification?.intent ?? "",
  ]
    .join("\n")
    .trim();

  const signals = buildSignals(
    combined,
    input.conversationMetadata,
    input.customerMetadata
  );
  const activeSignals = signals.filter((s) => s.active);

  let score = 22;
  const confidence = input.classification?.confidence;
  if (confidence != null && Number.isFinite(confidence)) {
    score += confidence * 38;
  } else {
    score += combined.length > 40 ? 18 : 8;
  }

  score += activeSignals.length * 9;

  const urgency = input.classification?.urgency;
  if (urgency === "urgent") score += 10;
  else if (urgency === "high") score += 6;

  if (input.status === "waiting_for_human") score += 6;
  if (input.department === "sales" || input.department === "bdc") score += 4;

  if (input.classification?.sentiment === "negative") score -= 12;

  const finalScore = clampOpportunityScore(score);
  const confidencePct = clampOpportunityScore(
    confidence != null && Number.isFinite(confidence)
      ? confidence * 100
      : Math.min(72, 38 + activeSignals.length * 10)
  );

  return {
    score: finalScore,
    intent_summary: intentSummaryForScore(
      finalScore,
      input.department,
      activeSignals.length
    ),
    confidence_pct: confidencePct,
    signals,
    updated_at: new Date().toISOString(),
  };
}
