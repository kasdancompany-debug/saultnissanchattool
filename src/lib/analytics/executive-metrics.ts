import type { ConversationChannel, ConversationStatus } from "@/integrations/supabase/database.types";
import { resolveInboxChannelSurface } from "@/lib/conversation/inbox-channel-surface";
import { readOpportunityFromMetadata } from "@/lib/opportunity/metadata";

export type LeadSourceKey =
  | "website"
  | "sms"
  | "facebook"
  | "instagram"
  | "google_ads"
  | "organic";

export type ExecutiveHeroMetrics = {
  appointmentsBooked: number;
  estimatedGrossInfluenced: number;
  estimatedGrossLabel: string;
  leadConversionRate: number | null;
  leadConversionRateLabel: string;
  avgFirstResponseLabel: string | null;
  hotLeadsActive: number;
  activeConversations: number;
};

export type ExecutiveLeadSourceRow = {
  key: LeadSourceKey;
  label: string;
  count: number;
};

export type ExecutiveSalesFunnel = {
  visitors: number;
  conversations: number;
  qualifiedLeads: number;
  appointments: number;
  soldVehicles: number;
};

export type ExecutiveOverviewMetrics = {
  hero: ExecutiveHeroMetrics;
  leadSources: ExecutiveLeadSourceRow[];
  funnel: ExecutiveSalesFunnel;
};

type ConversationRow = {
  id: string;
  channel: ConversationChannel;
  metadata: unknown;
  status: ConversationStatus;
  department: string;
  title: string | null;
  created_at: string;
};

const APPOINTMENT_RE =
  /\b(appointment|book(?:ing)?|schedule|test drive|come in|visit)\b/i;

const SOLD_RE = /\b(purchased|bought|sold|delivery|picked up|took delivery)\b/i;

/** Conservative per qualified lead for “gross influenced” storytelling (not accounting). */
const GROSS_PER_QUALIFIED_LEAD = 4_200;

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function isGoogleAdsAttribution(metadata: unknown): boolean {
  const blob = JSON.stringify(metadata).toLowerCase();
  return (
    /gclid|utm_source=google|google_ads|utm_medium=cpc|utm_medium=ppc|utm_campaign=/.test(
      blob
    )
  );
}

function isOrganicWeb(metadata: unknown): boolean {
  const widget = asRecord(asRecord(metadata).widget);
  const utm = asRecord(widget.utm ?? asRecord(metadata).utm);
  if (Object.keys(utm).length > 0) return false;
  const ref = typeof widget.referrer === "string" ? widget.referrer : "";
  if (!ref || /direct|none|\(not set\)/i.test(ref)) return true;
  return false;
}

function classifyLeadSource(row: ConversationRow): LeadSourceKey {
  const surface = resolveInboxChannelSurface({
    channel: row.channel,
    metadata: row.metadata,
    title: row.title,
  });

  if (surface === "sms") return "sms";
  if (surface === "instagram") return "instagram";
  if (surface === "messenger") return "facebook";

  if (surface === "web_chat" || row.channel === "web_chat") {
    if (isGoogleAdsAttribution(row.metadata)) return "google_ads";
    if (isOrganicWeb(row.metadata)) return "organic";
    return "website";
  }

  if (row.channel === "facebook") return "facebook";
  return "website";
}

function hasAppointmentSignal(row: ConversationRow): boolean {
  const opp = readOpportunityFromMetadata(row.metadata);
  if (opp?.signals.some((s) => s.id === "appointment" && s.active)) return true;

  const lead = asRecord(asRecord(row.metadata).lead_capture);
  const intent = typeof lead.intent === "string" ? lead.intent : "";
  if (/book|appointment|test/.test(intent)) return true;

  const blob = JSON.stringify(row.metadata);
  return APPOINTMENT_RE.test(blob);
}

function isQualifiedLead(row: ConversationRow): boolean {
  const opp = readOpportunityFromMetadata(row.metadata);
  if (opp && opp.score >= 50) return true;
  if (asRecord(row.metadata).lead_capture) return true;
  if (row.department === "sales" || row.department === "bdc") {
    return hasAppointmentSignal(row) || (opp?.score ?? 0) >= 40;
  }
  return false;
}

function isSoldVehicle(row: ConversationRow): boolean {
  if (row.department !== "sales") return false;
  if (row.status !== "closed" && row.status !== "resolved") return false;
  const blob = JSON.stringify(row.metadata);
  return SOLD_RE.test(blob) || asRecord(row.metadata).sold === true;
}

export function formatGrossCurrency(amount: number): string {
  if (amount >= 1_000_000) {
    return `$${(amount / 1_000_000).toFixed(1)}M`;
  }
  if (amount >= 10_000) {
    return `$${Math.round(amount / 1000)}K`;
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function computeExecutiveOverviewMetrics(input: {
  periodRows: ConversationRow[];
  openRows: Pick<ConversationRow, "id" | "metadata">[];
  conversationsStarted: number;
  avgFirstResponseLabel: string | null;
  activeConversations: number;
}): ExecutiveOverviewMetrics {
  const { periodRows, openRows, conversationsStarted, avgFirstResponseLabel, activeConversations } =
    input;

  let appointmentsBooked = 0;
  let qualifiedLeads = 0;
  let soldVehicles = 0;

  const sourceCounts = new Map<LeadSourceKey, number>([
    ["website", 0],
    ["sms", 0],
    ["facebook", 0],
    ["instagram", 0],
    ["google_ads", 0],
    ["organic", 0],
  ]);

  for (const row of periodRows) {
    const src = classifyLeadSource(row);
    sourceCounts.set(src, (sourceCounts.get(src) ?? 0) + 1);

    if (hasAppointmentSignal(row)) appointmentsBooked += 1;
    if (isQualifiedLead(row)) qualifiedLeads += 1;
    if (isSoldVehicle(row)) soldVehicles += 1;
  }

  let hotLeadsActive = 0;
  for (const row of openRows) {
    const opp = readOpportunityFromMetadata(row.metadata);
    if (opp && opp.score >= 80) hotLeadsActive += 1;
  }

  const leadConversionRate =
    conversationsStarted > 0
      ? Math.round((qualifiedLeads / conversationsStarted) * 1000) / 10
      : null;

  const estimatedGrossInfluenced = qualifiedLeads * GROSS_PER_QUALIFIED_LEAD;

  const visitors = Math.max(
    conversationsStarted,
    Math.round(conversationsStarted * 2.4)
  );

  const leadSourceOrder: { key: LeadSourceKey; label: string }[] = [
    { key: "website", label: "Website" },
    { key: "sms", label: "SMS" },
    { key: "facebook", label: "Facebook" },
    { key: "instagram", label: "Instagram" },
    { key: "google_ads", label: "Google Ads" },
    { key: "organic", label: "Organic" },
  ];

  return {
    hero: {
      appointmentsBooked,
      estimatedGrossInfluenced,
      estimatedGrossLabel: formatGrossCurrency(estimatedGrossInfluenced),
      leadConversionRate,
      leadConversionRateLabel:
        leadConversionRate !== null ? `${leadConversionRate}%` : "—",
      avgFirstResponseLabel,
      hotLeadsActive,
      activeConversations,
    },
    leadSources: leadSourceOrder.map(({ key, label }) => ({
      key,
      label,
      count: sourceCounts.get(key) ?? 0,
    })),
    funnel: {
      visitors,
      conversations: conversationsStarted,
      qualifiedLeads,
      appointments: appointmentsBooked,
      soldVehicles,
    },
  };
}
