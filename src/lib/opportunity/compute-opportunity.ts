import type {
  ConversationStatus,
  StaffDepartment,
} from "@/integrations/supabase/database.types";
import { readWidgetIntakeIntent } from "@/lib/conversation/widget-metadata";
import { clampOpportunityScore } from "@/lib/opportunity/score-band";
import { customerProposedVisit } from "@/lib/opportunity/appointment-readiness";
import {
  hasTireKickerLanguage,
  hasVehiclePurchaseIntent,
  isWidgetPurchaseIntent,
} from "@/lib/opportunity/purchase-intent";
import type {
  OpportunitySignal,
  OpportunitySignalId,
  OpportunitySnapshot,
} from "@/lib/opportunity/types";

const FINANCING_RE =
  /\b(financ(?:e|ing)|pre[- ]?approved|apr|lease|monthly payment|payment|credit|loan)\b/i;
const APPOINTMENT_RE =
  /\b(appointment|book(?:ing)?|schedule|test drive|come in|visit|stop by|can i (?:come|do|book))\b/i;
const TIMELINE_RE =
  /\b(today|tonight|tomorrow|this week|asap|right away|soon|timeline|by (?:mon|tue|wed|thu|fri|saturday|sunday))\b/i;
const TRADE_RE =
  /\b(trade(?:-|\s)?in|trade\s+in|want\s+to\s+trade|trading\s+in|trade\s+my|trade\s+value|instant\s+trade|appraisal|sell\s+my(?:\s+(?:car|vehicle|truck|suv))?)\b/i;

/** Widget menu choice — visitor self-selected topic. */
const INTAKE_SCORE_BOOST: Record<string, number> = {
  new_vehicle: 30,
  used_vehicle: 28,
  trade_value: 28,
  financing: 18,
  service: 6,
};

const SIGNAL_DEFS: { id: OpportunitySignalId; label: string; re: RegExp }[] = [
  { id: "financing", label: "Mentioned financing", re: FINANCING_RE },
  { id: "returning_visitor", label: "Returning visitor", re: /^$/ },
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

/** Staff-facing one-liner under the customer name in the inbox list. */
function intentSummaryForScore(
  score: number,
  activeCount: number,
  hasTradeSignal: boolean,
  hasPurchaseIntent: boolean,
  proposedVisit: boolean
): string {
  if (proposedVisit && score >= 68) {
    return "Visit proposed — confirm";
  }
  if (hasTradeSignal) {
    if (score >= 82) return "Hot lead — trade-in";
    if (score >= 65) return "Trade-in — follow up";
  }
  if (hasPurchaseIntent && score >= 82) {
    return "Hot lead";
  }
  if (score >= 82) {
    return activeCount >= 2 ? "Hot lead" : "Strong buyer";
  }
  if (score >= 68) {
    return hasPurchaseIntent ? "Strong buyer" : "Worth a call";
  }
  if (score >= 52) {
    return "Follow up soon";
  }
  if (score >= 38) {
    return "Qualify more";
  }
  return "Browsing";
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

  const widgetIntent = readWidgetIntakeIntent(input.conversationMetadata);
  const widgetPurchase = isWidgetPurchaseIntent(widgetIntent);

  const signals = buildSignals(
    combined,
    input.conversationMetadata,
    input.customerMetadata
  );
  if (widgetIntent === "trade_value") {
    const tradeSig = signals.find((s) => s.id === "trade");
    if (tradeSig) tradeSig.active = true;
  }
  if (customerProposedVisit(combined)) {
    const apptSig = signals.find((s) => s.id === "appointment");
    if (apptSig) apptSig.active = true;
  }
  const activeSignals = signals.filter((s) => s.active);
  const hasTradeSignal = activeSignals.some((s) => s.id === "trade");

  const purchaseInText = hasVehiclePurchaseIntent(combined);
  const tireKicker = hasTireKickerLanguage(combined);
  const hasPurchaseIntent = purchaseInText || widgetPurchase;
  const proposedVisit = customerProposedVisit(combined);

  let score = 10;

  if (purchaseInText) {
    score += 32;
  }
  if (widgetIntent && INTAKE_SCORE_BOOST[widgetIntent]) {
    score += INTAKE_SCORE_BOOST[widgetIntent];
  }

  for (const sig of activeSignals) {
    if (sig.id === "trade") score += 18;
    else if (sig.id === "appointment") score += 16;
    else if (sig.id === "timeline") score += 12;
    else if (sig.id === "financing") score += 10;
    else score += 8;
  }

  const confidence = input.classification?.confidence;
  if (confidence != null && Number.isFinite(confidence)) {
    score += confidence * 18;
  } else if (combined.length > 24) {
    score += 6;
  }

  const urgency = input.classification?.urgency;
  if (urgency === "urgent") score += 12;
  else if (urgency === "high") score += 8;

  if (input.status === "waiting_for_human") score += 8;
  if (input.department === "sales" || input.department === "bdc") score += 4;

  if (input.classification?.sentiment === "negative") score -= 10;

  if (tireKicker && !hasPurchaseIntent && activeSignals.length === 0) {
    score -= 22;
  }

  if (hasPurchaseIntent && !tireKicker) {
    score = Math.max(score, purchaseInText && widgetPurchase ? 86 : 78);
  }

  if (hasTradeSignal && widgetIntent === "trade_value") {
    score = Math.max(score, 84);
  }

  if (proposedVisit) {
    score = Math.max(score, 82);
  }

  if (tireKicker && !hasPurchaseIntent) {
    score = Math.min(score, 44);
  }

  const finalScore = clampOpportunityScore(score);
  const confidencePct = clampOpportunityScore(
    confidence != null && Number.isFinite(confidence)
      ? confidence * 100
      : Math.min(78, 42 + activeSignals.length * 8 + (hasPurchaseIntent ? 12 : 0))
  );

  return {
    score: finalScore,
    intent_summary: intentSummaryForScore(
      finalScore,
      activeSignals.length,
      hasTradeSignal,
      hasPurchaseIntent,
      proposedVisit
    ),
    confidence_pct: confidencePct,
    signals,
    updated_at: new Date().toISOString(),
  };
}
