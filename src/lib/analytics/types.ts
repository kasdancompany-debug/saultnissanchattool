import type { ExecutiveOverviewMetrics } from "@/lib/analytics/executive-metrics";
import type { DealershipLeadOfferAnalytics } from "@/lib/lead-offers/types";

/**
 * Executive analytics snapshot — structured for future ROI / benchmark exports
 * (e.g. vs Podium) without coupling to chart libraries.
 */
export type DealershipAnalyticsSnapshot = {
  generatedAtIso: string;
  reportingPeriod: {
    days: number;
    sinceIso: string;
    label: string;
  };
  /** Point-in-time queue depth (now). */
  snapshot: {
    openConversations: number;
    /** Terminal states excluding spam — “work completed”. */
    completedConversations: number;
  };
  /** Metrics limited to conversations created on or after `reportingPeriod.sinceIso`. */
  period: {
    /** Conversations started in the reporting window (denominator context). */
    conversationsStarted: number;
    /** Mean seconds from first inbound customer message to first staff message (same thread). */
    avgFirstResponseSeconds: number | null;
    /** Human-readable e.g. “4m 12s”. */
    avgFirstResponseLabel: string | null;
    /** Conversations in window where a staff reply occurred after the first customer message. */
    conversationsWithMeasuredFirstReply: number;
    byDepartment: { key: string; label: string; count: number }[];
    byChannel: { key: string; label: string; count: number }[];
    /** Web chat threads that began as after-hours intake (`metadata.widget.after_hours`). */
    afterHoursConversations: number;
    /** Distinct conversations with a `sentiment_escalation` event in the window. */
    sentimentEscalationEvents: number;
  };
  /** Open-queue rows assigned to each teammate + unassigned. */
  assignmentLoad: {
    staffUserId: string | null;
    displayName: string;
    openAssigned: number;
  }[];
  /** Daily teammate leaderboard for response accountability. */
  teamScoreboard: {
    dayStartIso: string;
    dayLabel: string;
    topPerformerStaffUserId: string | null;
    rows: {
      staffUserId: string;
      displayName: string;
      avgResponseSeconds: number | null;
      avgResponseLabel: string | null;
      conversationsHandled: number;
      responseRate: number;
      responseRateLabel: string;
      measuredResponses: number;
    }[];
  };
  /** Open conversations that still carry an active sentiment flag (needs attention). */
  openWithActiveSentimentFlag: number;
  /** Lead offer funnel (views → starts → completes → leads) for the reporting window. */
  leadOffers: DealershipLeadOfferAnalytics;
  /** Executive war-room KPIs for the Overview page. */
  executive: ExecutiveOverviewMetrics;
};
