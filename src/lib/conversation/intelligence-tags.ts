import {
  hasTireKickerLanguage,
  hasVehiclePurchaseIntent,
} from "@/lib/opportunity/purchase-intent";

export type ConversationIntelligenceTagKind =
  | "sales_lead"
  | "service_request"
  | "general_inquiry"
  | "high_intent"
  | "low_intent";

export type ConversationIntelligenceTag = {
  kind: ConversationIntelligenceTagKind;
  label: string;
};

const SALES_RE =
  /\b(buy|purchase|pricing?|payment|finance|financing|lease|apr|rate|trade(?:-in)?|test drive|inventory|in stock|availability|quote|msrp|trim|model|vin|new\s+(?:car|truck|suv)|used\s+(?:car|truck|suv)|want\s+a\s+new)\b/i;
const SERVICE_RE =
  /\b(service|oil|brake|repair|maintenance|tire|tyre|alignment|check engine|diagnostic|appointment for service|schedule service|book service)\b/i;

const HIGH_INTENT_RE =
  /\b(ready to buy|book(?:ing)?|schedule|appointment|test drive|come in|call me|reach me|available now|next step|can i come|what do i need to)\b/i;
const TRADE_HIGH_INTENT_RE =
  /\b(trade(?:-|\s)?in|trade\s+in|want\s+to\s+trade|trading\s+in|trade\s+my|sell\s+my\s+(?:car|vehicle|truck|suv)|trade\s+value|instant\s+trade|appraisal)\b/i;
const PURCHASE_INTENT_RE =
  /\b(want\s+to|looking\s+to|interested\s+in)\s+(?:buy|purchase|get|lease)\b/i;
const URGENCY_RE = /\b(today|tonight|asap|right now|immediately|this week)\b/i;
const LOW_INTENT_RE =
  /\b(just looking|curious|maybe|thinking about|not sure|later|sometime|browsing)\b/i;
const RESEARCH_RE = /\b(specs?|features?|difference|compare|vs\.?|review|info(?:rmation)?)\b/i;

function normalizeContent(content: string): string {
  return content.toLowerCase().trim().replace(/\s+/g, " ");
}

function detectTopicTag(content: string): ConversationIntelligenceTag {
  if (SERVICE_RE.test(content)) {
    return { kind: "service_request", label: "Service request" };
  }
  if (SALES_RE.test(content)) {
    return { kind: "sales_lead", label: "Sales lead" };
  }
  return { kind: "general_inquiry", label: "General inquiry" };
}

function detectIntentTag(content: string): ConversationIntelligenceTag {
  const hasHighIntent = HIGH_INTENT_RE.test(content);
  const hasTradeIntent = TRADE_HIGH_INTENT_RE.test(content);
  const hasPurchaseIntent =
    PURCHASE_INTENT_RE.test(content) || hasVehiclePurchaseIntent(content);
  const hasUrgency = URGENCY_RE.test(content);
  const hasLowIntent =
    LOW_INTENT_RE.test(content) || hasTireKickerLanguage(content);
  const hasResearchIntent = RESEARCH_RE.test(content);
  const hasActionableTopic = SALES_RE.test(content) || SERVICE_RE.test(content);

  if (
    hasHighIntent ||
    hasTradeIntent ||
    hasPurchaseIntent ||
    (hasUrgency && hasActionableTopic)
  ) {
    return { kind: "high_intent", label: "High intent" };
  }

  if (
    (hasLowIntent && !hasPurchaseIntent && !hasActionableTopic) ||
    (hasResearchIntent && !hasActionableTopic)
  ) {
    return { kind: "low_intent", label: "Low intent" };
  }

  // Fallback: actionable sales/service asks are at least moderate-high intent.
  const actionableNextStep =
    /\b(price|payment|quote|availability|appointment|book|schedule|test drive|service|trade)\b/i;
  return hasActionableTopic && actionableNextStep.test(content)
    ? { kind: "high_intent", label: "High intent" }
    : { kind: "low_intent", label: "Low intent" };
}

/**
 * Lightweight, deterministic conversation tags from latest conversation text.
 */
export function deriveConversationIntelligenceTags(
  rawContent: string | null | undefined
): ConversationIntelligenceTag[] {
  const content = normalizeContent(rawContent ?? "");
  if (!content) {
    return [];
  }

  return [detectTopicTag(content), detectIntentTag(content)];
}
