import type {
  ConversationChannel,
  ConversationStatus,
  StaffDepartment,
} from "@/integrations/supabase/database.types";
import { isAfterHoursWebChatIntake } from "@/lib/conversation/widget-metadata";
import { isSentimentEscalationActive } from "@/lib/conversation/sentiment-escalation-metadata";
import {
  ANALYTICS_REPORTING_DAYS,
  COMPLETED_CONVERSATION_STATUSES,
  OPEN_QUEUE_STATUSES,
} from "@/lib/analytics/constants";
import { computeAverageFirstResponseSeconds } from "@/lib/analytics/first-response";
import type { MessageTimingRow } from "@/lib/analytics/first-response";
import { computeExecutiveOverviewMetrics } from "@/lib/analytics/executive-metrics";
import type { DealershipAnalyticsSnapshot } from "@/lib/analytics/types";
import { loadLeadOfferAnalytics } from "@/server/data/lead-offers";
import { formatDurationSeconds } from "@/lib/analytics/format";
import { resolveDb } from "@/server/data/internal";
import { fromPostgrestError } from "@/server/data/postgrest-error";
import type { TypedSupabaseClient } from "@/server/db/server-client";
import { ok, type Result } from "@/server/result";

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

type MessageTimelineRow = {
  conversation_id: string;
  sender_type: "customer" | "staff" | "system" | "ai";
  sender_user_id: string | null;
  created_at: string;
};

async function fetchMessagesForFirstResponse(
  supabase: TypedSupabaseClient,
  conversationIds: string[]
): Promise<Result<MessageTimingRow[]>> {
  if (conversationIds.length === 0) {
    return ok([]);
  }

  const idChunks = chunk(conversationIds, 120);
  const chunkResults = await Promise.all(
    idChunks.map(async (ids) => {
      const rowsOut: MessageTimingRow[] = [];
      let offset = 0;
      const pageSize = 1000;
      for (;;) {
        const res = await supabase
          .from("messages")
          .select("conversation_id, sender_type, created_at")
          .in("conversation_id", ids)
          .order("conversation_id", { ascending: true })
          .order("created_at", { ascending: true })
          .range(offset, offset + pageSize - 1);

        if (res.error) {
          return fromPostgrestError(res.error);
        }
        const rows = res.data ?? [];
        if (rows.length === 0) {
          break;
        }
        for (const r of rows) {
          rowsOut.push({
            conversation_id: r.conversation_id,
            sender_type: r.sender_type,
            created_at: r.created_at,
          });
        }
        if (rows.length < pageSize) {
          break;
        }
        offset += pageSize;
      }

      return ok(rowsOut);
    })
  );

  const out: MessageTimingRow[] = [];
  for (const result of chunkResults) {
    if (!result.ok) {
      return result;
    }
    out.push(...result.data);
  }

  return ok(out);
}

async function fetchMessageTimelinesForDay(
  supabase: TypedSupabaseClient,
  dealershipId: string,
  dayStartIso: string
): Promise<Result<MessageTimelineRow[]>> {
  const convRes = await supabase
    .from("conversations")
    .select("id")
    .eq("dealership_id", dealershipId)
    .gte("updated_at", dayStartIso)
    .limit(50000);
  if (convRes.error) {
    return fromPostgrestError(convRes.error);
  }

  const conversationIds = (convRes.data ?? []).map((r) => r.id);
  if (conversationIds.length === 0) {
    return ok([]);
  }

  const out: MessageTimelineRow[] = [];
  const idChunks = chunk(conversationIds, 120);
  for (const ids of idChunks) {
    let offset = 0;
    const pageSize = 1000;
    for (;;) {
      const res = await supabase
        .from("messages")
        .select("conversation_id, sender_type, sender_user_id, created_at")
        .in("conversation_id", ids)
        .order("conversation_id", { ascending: true })
        .order("created_at", { ascending: true })
        .range(offset, offset + pageSize - 1);

      if (res.error) {
        return fromPostgrestError(res.error);
      }
      const rows = (res.data ?? []) as MessageTimelineRow[];
      if (rows.length === 0) {
        break;
      }
      out.push(...rows);
      if (rows.length < pageSize) {
        break;
      }
      offset += pageSize;
    }
  }

  return ok(out);
}

function utcDayLabel(dayStart: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(dayStart);
}

function buildTeamScoreboard(input: {
  dayStartIso: string;
  timelines: MessageTimelineRow[];
  staffNameMap: Map<string, string>;
}): DealershipAnalyticsSnapshot["teamScoreboard"] {
  const dayStartMs = Date.parse(input.dayStartIso);
  const byConversation = new Map<string, MessageTimelineRow[]>();
  for (const row of input.timelines) {
    const list = byConversation.get(row.conversation_id) ?? [];
    list.push(row);
    byConversation.set(row.conversation_id, list);
  }

  const responseLagsByStaff = new Map<string, number[]>();
  const handledConversationsByStaff = new Map<string, Set<string>>();
  const onTimeCountByStaff = new Map<string, number>();
  const measuredCountByStaff = new Map<string, number>();

  for (const [conversationId, timeline] of byConversation.entries()) {
    for (let i = 0; i < timeline.length; i += 1) {
      const base = timeline[i];
      const baseMs = Date.parse(base.created_at);
      if (base.sender_type !== "customer" || !Number.isFinite(baseMs) || baseMs < dayStartMs) {
        continue;
      }

      for (let j = i + 1; j < timeline.length; j += 1) {
        const next = timeline[j];
        if (next.sender_type !== "staff" || !next.sender_user_id) {
          continue;
        }
        const nextMs = Date.parse(next.created_at);
        if (!Number.isFinite(nextMs) || nextMs < baseMs) {
          continue;
        }
        const lagSeconds = Math.max(0, Math.round((nextMs - baseMs) / 1000));
        const staffId = next.sender_user_id;
        const lags = responseLagsByStaff.get(staffId) ?? [];
        lags.push(lagSeconds);
        responseLagsByStaff.set(staffId, lags);

        const handled = handledConversationsByStaff.get(staffId) ?? new Set<string>();
        handled.add(conversationId);
        handledConversationsByStaff.set(staffId, handled);

        measuredCountByStaff.set(staffId, (measuredCountByStaff.get(staffId) ?? 0) + 1);
        if (lagSeconds <= 15 * 60) {
          onTimeCountByStaff.set(staffId, (onTimeCountByStaff.get(staffId) ?? 0) + 1);
        }
        break;
      }
    }
  }

  const rows = [...responseLagsByStaff.keys()]
    .map((staffUserId) => {
      const lags = responseLagsByStaff.get(staffUserId) ?? [];
      const measuredResponses = measuredCountByStaff.get(staffUserId) ?? 0;
      const avgResponseSeconds =
        lags.length > 0
          ? Math.round(lags.reduce((sum, v) => sum + v, 0) / lags.length)
          : null;
      const onTime = onTimeCountByStaff.get(staffUserId) ?? 0;
      const responseRate = measuredResponses > 0 ? onTime / measuredResponses : 0;
      return {
        staffUserId,
        displayName: input.staffNameMap.get(staffUserId) ?? "Staff",
        avgResponseSeconds,
        avgResponseLabel:
          avgResponseSeconds != null ? formatDurationSeconds(avgResponseSeconds) : null,
        conversationsHandled: handledConversationsByStaff.get(staffUserId)?.size ?? 0,
        responseRate,
        responseRateLabel: `${Math.round(responseRate * 100)}%`,
        measuredResponses,
      };
    })
    .filter((r) => r.measuredResponses > 0)
    .sort((a, b) => {
      if (b.responseRate !== a.responseRate) {
        return b.responseRate - a.responseRate;
      }
      const aAvg = a.avgResponseSeconds ?? Number.POSITIVE_INFINITY;
      const bAvg = b.avgResponseSeconds ?? Number.POSITIVE_INFINITY;
      if (aAvg !== bAvg) {
        return aAvg - bAvg;
      }
      return b.conversationsHandled - a.conversationsHandled;
    });

  return {
    dayStartIso: input.dayStartIso,
    dayLabel: utcDayLabel(new Date(input.dayStartIso)),
    topPerformerStaffUserId: rows[0]?.staffUserId ?? null,
    rows,
  };
}

async function countByStatus(
  supabase: TypedSupabaseClient,
  dealershipId: string,
  statuses: readonly ConversationStatus[]
): Promise<Result<number>> {
  const res = await supabase
    .from("conversations")
    .select("id", { count: "exact", head: true })
    .eq("dealership_id", dealershipId)
    .in("status", [...statuses]);

  if (res.error) {
    return fromPostgrestError(res.error);
  }
  return ok(res.count ?? 0);
}

/**
 * Distinct conversations with ≥1 sentiment escalation event in the window (dealership-scoped).
 */
async function countSentimentEscalationsInPeriod(
  supabase: TypedSupabaseClient,
  dealershipId: string,
  sinceIso: string
): Promise<Result<number>> {
  const evRes = await supabase
    .from("conversation_events")
    .select("conversation_id, event_type, conversations!inner(dealership_id)")
    .gte("created_at", sinceIso)
    .eq("conversations.dealership_id", dealershipId)
    .limit(100000);

  if (evRes.error) {
    return fromPostgrestError(evRes.error);
  }

  const seen = new Set(
    (evRes.data ?? [])
      .filter((e) => e.event_type === "sentiment_escalation")
      .map((e) => e.conversation_id)
  );
  return ok(seen.size);
}

/**
 * Loads dealership analytics using the authenticated Supabase client (RLS).
 */
export async function loadDealershipAnalytics(
  dealershipId: string,
  db?: TypedSupabaseClient
): Promise<Result<DealershipAnalyticsSnapshot>> {
  const supabase = await resolveDb(db);

  const now = new Date();
  const dayStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
  const dayStartIso = dayStart.toISOString();
  const since = new Date(now);
  since.setUTCDate(since.getUTCDate() - ANALYTICS_REPORTING_DAYS);
  const sinceIso = since.toISOString();

  const [openRes, completedRes, sentimentPeriodRes] = await Promise.all([
    countByStatus(supabase, dealershipId, OPEN_QUEUE_STATUSES),
    countByStatus(supabase, dealershipId, COMPLETED_CONVERSATION_STATUSES),
    countSentimentEscalationsInPeriod(supabase, dealershipId, sinceIso),
  ]);

  if (!openRes.ok) {
    return openRes;
  }
  if (!completedRes.ok) {
    return completedRes;
  }
  if (!sentimentPeriodRes.ok) {
    return sentimentPeriodRes;
  }

  const [periodRes, openQueueRes, dayTimelinesRes, leadOffersRes] = await Promise.all([
    supabase
      .from("conversations")
      .select(
        "id, department, channel, metadata, status, assigned_to_user_id, created_at, title"
      )
      .eq("dealership_id", dealershipId)
      .gte("created_at", sinceIso)
      .limit(50000),
    supabase
      .from("conversations")
      .select("id, metadata, assigned_to_user_id")
      .eq("dealership_id", dealershipId)
      .in("status", [...OPEN_QUEUE_STATUSES])
      .limit(50000),
    fetchMessageTimelinesForDay(supabase, dealershipId, dayStartIso),
    loadLeadOfferAnalytics(dealershipId, sinceIso, supabase),
  ]);

  if (periodRes.error) {
    return fromPostgrestError(periodRes.error);
  }
  if (openQueueRes.error) {
    return fromPostgrestError(openQueueRes.error);
  }
  if (!dayTimelinesRes.ok) {
    return dayTimelinesRes;
  }
  if (!leadOffersRes.ok) {
    return leadOffersRes;
  }

  const periodRows = periodRes.data ?? [];
  const conversationsStarted = periodRows.length;

  const deptCounts = new Map<string, number>();
  const channelCounts = new Map<string, number>();
  let afterHours = 0;

  for (const row of periodRows) {
    const d = row.department as StaffDepartment;
    deptCounts.set(d, (deptCounts.get(d) ?? 0) + 1);
    const ch = row.channel as ConversationChannel;
    channelCounts.set(ch, (channelCounts.get(ch) ?? 0) + 1);
    if (isAfterHoursWebChatIntake(row.metadata)) {
      afterHours += 1;
    }
  }

  const openRows = openQueueRes.data ?? [];
  let openSentimentFlag = 0;
  for (const row of openRows) {
    if (isSentimentEscalationActive(row.metadata)) {
      openSentimentFlag += 1;
    }
  }

  const loadMap = new Map<string | null, number>();
  for (const row of openRows) {
    const k = row.assigned_to_user_id;
    loadMap.set(k, (loadMap.get(k) ?? 0) + 1);
  }

  const staffIds = [...loadMap.keys()].filter((k): k is string => k !== null);

  const staffNameMap = new Map<string, string>();
  if (staffIds.length > 0) {
    const staffRes = await supabase
      .from("staff_users")
      .select("id, display_name")
      .eq("dealership_id", dealershipId)
      .in("id", staffIds);

    if (staffRes.error) {
      return fromPostgrestError(staffRes.error);
    }
    for (const s of staffRes.data ?? []) {
      staffNameMap.set(s.id, s.display_name?.trim() || "Staff");
    }
  }

  const assignmentLoad: DealershipAnalyticsSnapshot["assignmentLoad"] = [];
  const unassigned = loadMap.get(null) ?? 0;
  if (unassigned > 0) {
    assignmentLoad.push({
      staffUserId: null,
      displayName: "Unassigned",
      openAssigned: unassigned,
    });
  }
  for (const id of staffIds) {
    assignmentLoad.push({
      staffUserId: id,
      displayName: staffNameMap.get(id) ?? "Staff",
      openAssigned: loadMap.get(id) ?? 0,
    });
  }
  assignmentLoad.sort((a, b) => b.openAssigned - a.openAssigned);

  const teamScoreboard = buildTeamScoreboard({
    dayStartIso,
    timelines: dayTimelinesRes.data,
    staffNameMap,
  });

  const periodConvIds = periodRows.map((r) => r.id);
  const timingRes = await fetchMessagesForFirstResponse(supabase, periodConvIds);
  if (!timingRes.ok) {
    return timingRes;
  }

  const fr = computeAverageFirstResponseSeconds(timingRes.data);
  const avgSeconds = fr.avgSeconds;
  const avgLabel =
    fr.avgSeconds !== null ? formatDurationSeconds(fr.avgSeconds) : null;

  const deptOrder: StaffDepartment[] = [
    "sales",
    "service",
    "parts",
    "bdc",
    "management",
    "general",
  ];
  const byDepartment = deptOrder
    .filter((k) => (deptCounts.get(k) ?? 0) > 0)
    .map((k) => ({
      key: k,
      label: k,
      count: deptCounts.get(k) ?? 0,
    }));

  const chOrder: ConversationChannel[] = [
    "web_chat",
    "sms",
    "email",
    "facebook",
    "other",
  ];
  const byChannel = chOrder
    .filter((k) => (channelCounts.get(k) ?? 0) > 0)
    .map((k) => ({
      key: k,
      label: k,
      count: channelCounts.get(k) ?? 0,
    }));

  const executive = computeExecutiveOverviewMetrics({
    periodRows,
    openRows: openRows.map((r) => ({ id: r.id, metadata: r.metadata })),
    conversationsStarted,
    avgFirstResponseLabel: avgLabel,
    activeConversations: openRes.data,
  });

  return ok({
    generatedAtIso: now.toISOString(),
    reportingPeriod: {
      days: ANALYTICS_REPORTING_DAYS,
      sinceIso,
      label: `Last ${ANALYTICS_REPORTING_DAYS} days`,
    },
    snapshot: {
      openConversations: openRes.data,
      completedConversations: completedRes.data,
    },
    period: {
      conversationsStarted,
      avgFirstResponseSeconds: avgSeconds,
      avgFirstResponseLabel: avgLabel,
      conversationsWithMeasuredFirstReply: fr.measuredConversations,
      byDepartment,
      byChannel,
      afterHoursConversations: afterHours,
      sentimentEscalationEvents: sentimentPeriodRes.data,
    },
    assignmentLoad,
    teamScoreboard,
    openWithActiveSentimentFlag: openSentimentFlag,
    leadOffers: leadOffersRes.data,
    executive,
  });
}
