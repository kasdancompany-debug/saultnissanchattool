import type { ConversationChannel, ConversationStatus } from "@/integrations/supabase/database.types";
import {
  classifyLeadSource,
  type LeadSourceKey,
} from "@/lib/analytics/lead-source-attribution";
import {
  hasAppointmentBooked,
  isQualifiedLead,
  isSoldVehicle,
} from "@/lib/conversation/pipeline-outcomes";
import { readOpportunityFromMetadata } from "@/lib/opportunity/metadata";

export type { LeadSourceKey } from "@/lib/analytics/lead-source-attribution";

export type ExecutiveHeroMetrics = {
  appointmentsBooked: number;
  qualifiedLeads: number;
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
    const src = classifyLeadSource({
      channel: row.channel,
      metadata: row.metadata,
      title: row.title,
    });
    sourceCounts.set(src, (sourceCounts.get(src) ?? 0) + 1);

    const metricsInput = {
      status: row.status,
      department: row.department,
      metadata: row.metadata,
    };
    if (hasAppointmentBooked(metricsInput)) appointmentsBooked += 1;
    if (isQualifiedLead(metricsInput)) qualifiedLeads += 1;
    if (isSoldVehicle(metricsInput)) soldVehicles += 1;
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
      qualifiedLeads,
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
      conversations: conversationsStarted,
      qualifiedLeads,
      appointments: appointmentsBooked,
      soldVehicles,
    },
  };
}
