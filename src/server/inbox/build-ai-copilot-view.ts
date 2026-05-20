import "server-only";

import type {
  ConversationStatus,
  StaffDepartment,
} from "@/integrations/supabase/database.types";
import { computeOpportunityScore } from "@/lib/opportunity/compute-opportunity";
import { readAiInsightsFromMetadata } from "@/lib/conversation/ai-insights-metadata";
import { readOpportunityFromMetadata } from "@/lib/opportunity/metadata";
import { opportunityBandLabel } from "@/lib/opportunity/score-band";

const DEPARTMENT_LABEL: Record<StaffDepartment, string> = {
  sales: "Sales",
  service: "Service",
  parts: "Parts",
  bdc: "BDC",
  management: "Management",
  general: "General",
};
import type { InboxMessageView } from "@/server/data/inbox";
import type { AiCopilotView } from "@/types/ai-copilot";
import type { AiAssistPanelView } from "@/types/ai-assist-panel";

const APPOINTMENT_RE =
  /\b(appointment|book(?:ing)?|schedule|test drive|come in|visit)\b/i;
const PRICE_RE = /\b(price|pricing|payment|lease|finance|cost|apr)\b/i;
const AVAIL_RE = /\b(avail|stock|in stock|have one)\b/i;
const TRADE_RE = /\b(trade|trade-in|trade in)\b/i;
const TIMELINE_RE = /\b(today|tomorrow|this week|asap|soon)\b/i;
const NEGATIVE_RE =
  /\b(too expensive|can't afford|not sure|thinking|maybe|competitor|elsewhere)\b/i;

function collectCustomerText(messages: InboxMessageView[]): string {
  return messages
    .filter((m) => m.sender_type === "customer")
    .map((m) => m.body.trim())
    .filter(Boolean)
    .join("\n");
}

function inferInventory(text: string, intent: string): string[] {
  const blob = `${text}\n${intent}`.toLowerCase();
  const picks: string[] = [];

  const models = [
    "rogue",
    "pathfinder",
    "frontier",
    "altima",
    "sentra",
    "kicks",
    "murano",
    "titan",
    "armada",
  ];
  for (const model of models) {
    if (blob.includes(model)) {
      picks.push(
        `Nissan ${model.charAt(0).toUpperCase()}${model.slice(1)} — match in-stock or incoming`
      );
    }
  }

  if (picks.length === 0) {
    if (TRADE_RE.test(blob)) {
      picks.push("Trade-friendly SUV or truck with strong equity position");
    } else if (PRICE_RE.test(blob)) {
      picks.push("Value-focused new or certified unit with current incentives");
    } else {
      picks.push("Best match from live inventory once trim and budget are confirmed");
    }
  }

  return picks.slice(0, 3);
}

function inferObjections(text: string, assist: AiAssistPanelView | null): string[] {
  const objections: string[] = [];
  if (PRICE_RE.test(text) || assist?.intent.toLowerCase().includes("price")) {
    objections.push("Payment or monthly budget not yet confirmed");
  }
  if (NEGATIVE_RE.test(text)) {
    objections.push("Still comparing options or timing");
  }
  if (AVAIL_RE.test(text) && !/\b(yes|have|available)\b/i.test(text)) {
    objections.push("Uncertainty about availability or timeline");
  }
  if (assist?.escalateEffective) {
    objections.push("May want a human for numbers or commitments");
  }
  if (objections.length === 0) {
    objections.push("No strong objections detected — keep discovery light");
  }
  return objections.slice(0, 4);
}

function buildSuggestedResponses(
  assist: AiAssistPanelView | null,
  text: string
): string[] {
  const out = new Set<string>();

  if (assist?.safeDraftReply.trim()) {
    out.add(assist.safeDraftReply.trim());
  }

  if (APPOINTMENT_RE.test(text)) {
    out.add(
      "Absolutely — I can get that scheduled. What day and time works best for you?"
    );
  } else {
    out.add(
      "Happy to help. Would you like to stop in for a quick visit or test drive this week?"
    );
  }

  if (AVAIL_RE.test(text)) {
    out.add(
      "I can confirm availability right away. Which model and trim are you considering?"
    );
  }

  if (PRICE_RE.test(text) || TRADE_RE.test(text)) {
    out.add(
      "I can pull together accurate numbers for you. What vehicle and budget range should I use?"
    );
  }

  return Array.from(out).slice(0, 3);
}

function buildNextActions(
  assist: AiAssistPanelView | null,
  text: string,
  hasAssignee: boolean
): string[] {
  const actions: string[] = [];

  if (!hasAssignee) {
    actions.push("Claim ownership so follow-up stays consistent");
  }
  if (assist?.escalateEffective) {
    actions.push("Prioritize human response — escalation rules fired");
  }
  if (APPOINTMENT_RE.test(text)) {
    actions.push("Confirm appointment date, time, and vehicle");
  } else {
    actions.push("Offer a concrete next step (visit, call, or test drive)");
  }
  if (PRICE_RE.test(text) || TRADE_RE.test(text)) {
    actions.push("Gather budget, trade details, and timeline before quoting");
  }
  if (TIMELINE_RE.test(text)) {
    actions.push("Acknowledge their timeline and align inventory");
  }
  if (actions.length < 3) {
    actions.push("Confirm contact info and preferred channel");
  }

  return actions.slice(0, 4);
}

function buildSummary(
  assist: AiAssistPanelView | null,
  opportunitySummary: string,
  messageCount: number
): string {
  if (assist?.recommendedAction) {
    return `${opportunitySummary} ${assist.recommendedAction}`.trim();
  }
  if (messageCount === 0) {
    return "New thread — no customer messages yet. Introduce yourself and ask one clear qualifying question.";
  }
  return `${opportunitySummary} Review the latest customer message and respond with one helpful next step.`;
}

export function buildAiCopilotView(input: {
  customerDisplayName: string;
  customerEmail: string | null;
  customerPhoneE164: string | null;
  messages: InboxMessageView[];
  conversationMetadata: unknown;
  department: StaffDepartment;
  status: ConversationStatus;
  assist: AiAssistPanelView | null;
  hasAssignee: boolean;
}): AiCopilotView {
  const customerText = collectCustomerText(input.messages);
  const aiInsights = readAiInsightsFromMetadata(input.conversationMetadata);
  const opportunity =
    readOpportunityFromMetadata(input.conversationMetadata) ??
    computeOpportunityScore({
      messageText: customerText,
      classification: input.assist
        ? {
            intent: input.assist.intent,
            confidence: input.assist.confidence,
            urgency: input.assist.urgency,
            sentiment: input.assist.sentiment,
          }
        : null,
      conversationMetadata: input.conversationMetadata,
      status: input.status,
      department: input.department,
    });

  let appointmentProbability = opportunity.score;
  if (opportunity.signals.some((s) => s.id === "appointment" && s.active)) {
    appointmentProbability = Math.min(100, appointmentProbability + 12);
  }
  if (APPOINTMENT_RE.test(customerText)) {
    appointmentProbability = Math.min(100, appointmentProbability + 8);
  }

  const leadMeta = input.conversationMetadata as Record<string, unknown> | null;
  const leadCapture = leadMeta?.lead_capture as Record<string, unknown> | undefined;
  const intentLevel = aiInsights?.intent_level ?? (
    opportunity.score >= 80 ? "high" : opportunity.score >= 50 ? "medium" : "low"
  );
  const routingDepartment =
    aiInsights?.department ?? input.department;
  const intentSummary =
    aiInsights?.intent ?? input.assist?.intent ?? opportunity.intent_summary;

  const profileNotes = [
    typeof leadCapture?.summary === "string" ? leadCapture.summary : null,
    intentSummary ? `Intent: ${intentSummary}` : null,
    aiInsights?.missing_profile_fields.length
      ? `Still need: ${aiInsights.missing_profile_fields.join(", ")}`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const missingFields =
    aiInsights?.missing_profile_fields ??
    [
      ...(!input.customerDisplayName || input.customerDisplayName === "Website visitor"
        ? ["name"]
        : []),
      ...(!input.customerPhoneE164 ? ["phone"] : []),
      ...(!input.customerEmail ? ["email"] : []),
    ];

  const primaryDraft =
    input.assist?.safeDraftReply.trim() ||
    buildSuggestedResponses(input.assist, customerText)[0] ||
    "Thanks for reaching out — how can I help you today?";

  const intentLevelLabel = opportunityBandLabel(intentLevel);

  return {
    routingDepartment,
    routingDepartmentLabel: DEPARTMENT_LABEL[routingDepartment] ?? routingDepartment,
    intentSummary,
    intentLevel,
    intentLevelLabel,
    summary: buildSummary(
      input.assist,
      aiInsights?.recommended_action ?? opportunity.intent_summary,
      input.messages.length
    ),
    nextActions: buildNextActions(input.assist, customerText, input.hasAssignee),
    suggestedResponses: buildSuggestedResponses(input.assist, customerText),
    customerProfile: {
      displayName: input.customerDisplayName,
      email:
        input.customerEmail ?? aiInsights?.customer_profile.email ?? null,
      phoneE164:
        input.customerPhoneE164 ??
        aiInsights?.customer_profile.phone_e164 ??
        null,
      notes: profileNotes || null,
      missingFields,
    },
    likelyObjections: inferObjections(customerText, input.assist),
    opportunityScore: opportunity.score,
    appointmentProbability,
    appointmentProbabilityLabel: `${Math.round(appointmentProbability)}% likely`,
    recommendedInventory: inferInventory(customerText, input.assist?.intent ?? ""),
    primaryDraftReply: primaryDraft,
    classification: input.assist,
  };
}
