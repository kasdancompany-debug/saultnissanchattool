import { intentLabel } from "@/lib/widget/lead-capture/flows";
import type { WidgetLeadCapturePayload } from "@/lib/widget/lead-capture/types";

const CONDITION_LABEL: Record<string, string> = {
  excellent: "Excellent",
  good: "Good",
  fair: "Fair",
  needs_work: "Needs work",
};

const TIMELINE_LABEL: Record<string, string> = {
  asap: "ASAP",
  two_weeks: "1–2 weeks",
  one_to_three_months: "1–3 months",
  browsing: "Just browsing",
};

const FINANCING_LABEL: Record<string, string> = {
  yes: "Yes",
  maybe: "Maybe",
  no: "Not now",
};

/** First customer message in thread after guided intake (staff-visible context). */
export function buildLeadCaptureSummaryMessage(lead: WidgetLeadCapturePayload): string {
  const lines: string[] = [
    `[Lead intake — ${intentLabel(lead.intent)}]`,
    "",
  ];

  if (lead.intent === "trade_value") {
    if (lead.trade_vehicle) lines.push(`Current vehicle: ${lead.trade_vehicle}`);
    if (lead.trade_year) lines.push(`Year: ${lead.trade_year}`);
    if (lead.trade_km) lines.push(`Approx. KM: ${lead.trade_km}`);
    if (lead.trade_condition) {
      lines.push(`Condition: ${CONDITION_LABEL[lead.trade_condition] ?? lead.trade_condition}`);
    }
  } else {
    if (lead.vehicle_interest) lines.push(`Vehicle interest: ${lead.vehicle_interest}`);
    if (lead.service_need) lines.push(`Service need: ${lead.service_need}`);
    if (lead.general_question) lines.push(`Question: ${lead.general_question}`);
    if (lead.timeline) {
      lines.push(`Timeline: ${TIMELINE_LABEL[lead.timeline] ?? lead.timeline}`);
    }
    if (lead.financing_interest) {
      lines.push(
        `Financing: ${FINANCING_LABEL[lead.financing_interest] ?? lead.financing_interest}`
      );
    }
  }

  lines.push("");
  lines.push(`Name: ${lead.name}`);
  lines.push(`Phone: ${lead.phone_e164}`);
  if (lead.email?.trim()) {
    lines.push(`Email: ${lead.email.trim()}`);
  }

  return lines.join("\n").trim();
}

export function buildLeadConversationTitle(lead: WidgetLeadCapturePayload): string {
  const base = intentLabel(lead.intent);
  const name = lead.name.trim();
  return name ? `${base} — ${name}` : base;
}
