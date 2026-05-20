import type { ComponentType, ReactNode } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  Inbox,
  Megaphone,
  Sparkles,
  Users,
} from "lucide-react";

import { buildInboxHref } from "@/components/inbox/inbox-params";
import {
  formatChannelLabel,
  formatDepartmentLabel,
} from "@/components/inbox/inbox-labels";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import type { DealershipAnalyticsSnapshot } from "@/lib/analytics/types";
import type { DealershipLeadOfferAnalytics } from "@/lib/lead-offers/types";
import {
  cardElevationClassName,
  cardPanelBodyClassName,
  cardPanelClassName,
  cardPanelHeaderClassName,
} from "@/lib/ui/panel";
import { cn } from "@/lib/utils";
import type { ConversationChannel, StaffDepartment } from "@/integrations/supabase/database.types";

/** Major vertical band — top rule + spacing separates KPI / queue / breakdowns / detail blocks. */
function AnalyticsMajorSection({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "border-border scroll-mt-6 border-t pt-10 first:border-t-0 first:pt-0 sm:pt-12",
        className
      )}
    >
      {children}
    </section>
  );
}

/** Shared section title stack: strong title, primary eyebrow, quiet supporting line. */
function AnalyticsSectionHeader({
  eyebrow,
  title,
  description,
  aside,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  aside?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-x-5 gap-y-3">
      <div className="min-w-0 max-w-[min(100%,40rem)] space-y-1.5">
        <p className="text-primary text-[10px] font-bold tracking-[0.2em] uppercase">{eyebrow}</p>
        <h2 className="text-foreground text-[1.25rem] font-bold tracking-[-0.04em] sm:text-[1.4375rem] sm:leading-tight">
          {title}
        </h2>
        {description ? (
          <p className="text-muted-foreground max-w-xl text-[10.5px] font-normal leading-snug sm:text-[11px]">
            {description}
          </p>
        ) : null}
      </div>
      {aside ? (
        <div className="text-muted-foreground flex shrink-0 flex-wrap items-center gap-1.5 text-[10px] font-normal tabular-nums opacity-90">
          {aside}
        </div>
      ) : null}
    </div>
  );
}

function kpiDelta(kind: "queue" | "success" | "time" | "volume", value: number): string {
  if (kind === "queue") {
    if (value === 0) return "Queue clear · great moment to get ahead";
    if (value > 15) return "Elevated load · prioritize inbox first";
    return "Healthy throughput · keep response times tight";
  }
  if (kind === "success") return "Closed outcomes across all time";
  if (kind === "time") return "Speed builds trust on every channel";
  return "New threads opened in this reporting window";
}

function KpiCard({
  label,
  value,
  hint,
  kind,
  numericValue,
  footnote,
}: {
  label: string;
  value: string | number;
  hint?: string;
  kind: "queue" | "success" | "time" | "volume";
  numericValue: number;
  footnote?: string;
}) {
  const delta = kpiDelta(kind, numericValue);
  /** Short context only — full definitions stay in `title` for hover / SR. */
  const glanceLine = [footnote, delta].filter(Boolean).join(" · ");

  return (
    <div
      title={hint}
      className={cn(
        "text-card-foreground flex h-full min-h-[12.5rem] flex-col overflow-hidden rounded-md",
        "bg-gradient-to-b from-primary/[0.055] to-card dark:from-primary/[0.09] dark:to-card",
        cardElevationClassName,
        "transition-[box-shadow,background-color] duration-150",
        "hover:shadow-[0_2px_4px_rgba(15,23,42,0.07),0_8px_22px_-4px_rgba(15,23,42,0.12),0_22px_52px_-12px_rgba(15,23,42,0.11),0_40px_80px_-20px_rgba(15,23,42,0.09)]",
        "dark:hover:shadow-[0_1px_0_rgba(0,0,0,0.55),0_8px_30px_-4px_rgba(0,0,0,0.62),0_36px_64px_-12px_rgba(0,0,0,0.58)]"
      )}
    >
      <div className="flex h-7 shrink-0 items-center px-3.5 pt-3 sm:px-4 sm:pt-3.5">
        <p className="text-muted-foreground line-clamp-1 w-full text-[9px] font-medium tracking-[0.14em] uppercase">
          {label}
        </p>
      </div>
      <div className="flex min-h-0 flex-1 flex-col px-3.5 pb-3.5 pt-1 sm:px-4 sm:pb-4">
        <div className="flex min-h-[5.25rem] flex-1 items-center sm:min-h-[5.75rem] lg:min-h-[6.25rem]">
          <p className="text-foreground w-full font-black tabular-nums tracking-[-0.06em] text-[clamp(2.75rem,7.5vw,4rem)] leading-[0.88] sm:text-[clamp(3.25rem,6.2vw,4.75rem)] lg:text-[clamp(3.75rem,5.5vw,5.5rem)]">
            {value}
          </p>
        </div>
        <p className="text-muted-foreground/85 line-clamp-1 pt-1 text-[10px] font-normal leading-tight">
          {glanceLine}
        </p>
        {hint ? <span className="sr-only">{hint}</span> : null}
      </div>
    </div>
  );
}

function InsightBarBlock({
  title,
  description,
  rows,
  formatLabel,
  emptyCta,
}: {
  title: string;
  description: string;
  rows: { key: string; label: string; count: number }[];
  formatLabel: (key: string) => string;
  emptyCta: { label: string; href: string; hint: string };
}) {
  const isEmpty = rows.length === 0;

  if (isEmpty) {
    return (
      <div className={cn(cardPanelClassName, "flex flex-col")}>
        <div className={cn(cardPanelHeaderClassName, "items-start py-1.5")}>
          <div className="min-w-0 space-y-1">
            <h3 className="text-foreground text-[13px] font-bold tracking-[-0.025em]">{title}</h3>
            <p className="text-muted-foreground text-[10px] font-normal leading-relaxed">
              {description}
            </p>
          </div>
        </div>
        <div className="bg-muted/35 mx-3 mb-3 mt-1 flex flex-1 flex-col items-start justify-center rounded-md px-3 py-4">
          <p className="text-foreground text-[13px] font-semibold tracking-tight">
            No conversations in this period yet
          </p>
          <p className="text-muted-foreground mt-1 max-w-sm text-[11px] font-normal leading-relaxed">
            {emptyCta.hint}
          </p>
          <Link
            href={emptyCta.href}
            className={cn(buttonVariants({ variant: "default", size: "sm" }), "mt-3 inline-flex gap-1.5")}
          >
            {emptyCta.label}
            <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        </div>
      </div>
    );
  }

  const max = Math.max(...rows.map((r) => r.count), 1);

  return (
    <div className={cardPanelClassName}>
      <div className={cn(cardPanelHeaderClassName, "items-start py-1.5")}>
        <div className="min-w-0 space-y-1">
          <h3 className="text-foreground text-[13px] font-bold tracking-[-0.025em]">{title}</h3>
          <p className="text-muted-foreground/80 text-[10px] font-normal leading-relaxed">{description}</p>
        </div>
      </div>
      <ul className={cn(cardPanelBodyClassName, "space-y-2.5")}>
        {rows.map((r) => (
          <li key={r.key}>
            <div className="flex items-baseline justify-between gap-3 text-[13px]">
              <span className="text-muted-foreground text-[12px] font-normal">
                {formatLabel(r.key)}
              </span>
              <Badge variant="secondary" className="tabular-nums text-[12px] font-bold">
                {r.count}
              </Badge>
            </div>
            <div className="bg-muted mt-1 h-1 overflow-hidden rounded-full">
              <div
                className="from-primary to-primary/80 h-full rounded-full bg-gradient-to-r transition-[width]"
                style={{ width: `${Math.min(100, (r.count / max) * 100)}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function LiveQueueSection({
  unassignedCount,
  mineCount,
  humanReviewCount,
}: {
  unassignedCount: number;
  mineCount: number;
  humanReviewCount: number;
}) {
  const rows: {
    key: string;
    title: string;
    description: string;
    count: number;
    href: string;
    icon: ComponentType<{ className?: string }>;
    badgeVariant: "default" | "secondary" | "destructive" | "outline";
  }[] = [
    {
      key: "unassigned",
      title: "Unassigned",
      description: "No owner yet — claim or assign from the inbox.",
      count: unassignedCount,
      href: buildInboxHref("unassigned"),
      icon: Users,
      badgeVariant: unassignedCount > 0 ? "destructive" : "secondary",
    },
    {
      key: "human",
      title: "Needs human",
      description:
        "Open threads with active sentiment or escalation flags (handoff review).",
      count: humanReviewCount,
      href: buildInboxHref("all_open"),
      icon: AlertCircle,
      badgeVariant: humanReviewCount > 0 ? "default" : "secondary",
    },
    {
      key: "mine",
      title: "My conversations",
      description: "Everything you own in the active queue right now.",
      count: mineCount,
      href: buildInboxHref("mine"),
      icon: Inbox,
      badgeVariant: "outline",
    },
  ];

  return (
    <div className="space-y-4">
      <AnalyticsSectionHeader
        eyebrow="Inbox"
        title="Live queue"
        description="Open pipeline counts — jump in when you need to claim, hand off, or clear work."
        aside={
          <Link
            href={buildInboxHref("all_open")}
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "inline-flex gap-1.5"
            )}
          >
            Open inbox
            <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        }
      />
      <div className="grid gap-3 sm:grid-cols-3">
        {rows.map((row) => {
          const RowIcon = row.icon;
          return (
          <Link
            key={row.key}
            href={row.href}
            className={cn(
              cardPanelClassName,
              "group block transition-[background-color,box-shadow] duration-150 ease-out motion-reduce:transition-none",
              "hover:bg-muted/25 hover:shadow-[0_1px_0_rgba(15,23,42,0.05),0_4px_14px_-4px_rgba(15,23,42,0.1),0_14px_36px_-12px_rgba(15,23,42,0.08)]"
            )}
          >
            <div className={cn(cardPanelHeaderClassName, "items-center")}>
              <div className="text-muted-foreground flex min-w-0 items-center gap-2">
                <RowIcon className="size-3.5 shrink-0 opacity-90" aria-hidden />
                <span className="text-foreground truncate text-[13px] font-semibold tracking-tight">
                  {row.title}
                </span>
              </div>
              <Badge variant={row.badgeVariant} className="shrink-0 tabular-nums text-[12px] font-bold">
                {row.count}
              </Badge>
            </div>
            <div className={cn(cardPanelBodyClassName, "pt-2")}>
              <p className="text-muted-foreground/80 text-[10px] font-normal leading-relaxed">
                {row.description}
              </p>
              <div className="text-primary mt-1.5 flex items-center text-[10px] font-semibold opacity-0 transition-opacity group-hover:opacity-100">
                View in inbox
                <ArrowRight className="ml-1 size-3" aria-hidden />
              </div>
            </div>
          </Link>
          );
        })}
      </div>
      <p className="text-muted-foreground text-[9px] font-normal leading-relaxed">
        Inbox list chips: <span className="text-foreground font-medium">Needs human</span> matches
        threads with active review flags in metadata.
      </p>
    </div>
  );
}

function TeamPerformanceScoreboard({
  scoreboard,
}: {
  scoreboard: DealershipAnalyticsSnapshot["teamScoreboard"];
}) {
  return (
    <div className="space-y-4">
      <AnalyticsSectionHeader
        eyebrow="Team"
        title="Daily performance scoreboard"
        description="Leaderboard updates daily with response speed, handled volume, and on-time response rate."
        aside={
          <span className="text-muted-foreground/85">
            UTC day · <span className="text-foreground font-medium">{scoreboard.dayLabel}</span>
          </span>
        }
      />
      {scoreboard.rows.length === 0 ? (
        <div className="bg-muted/35 rounded-md border px-4 py-4">
          <p className="text-foreground text-[13px] font-semibold">No measured replies yet today</p>
          <p className="text-muted-foreground mt-1 text-[11px] leading-relaxed">
            The leaderboard appears after customer messages receive staff replies.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-md border bg-card">
          <div className="grid grid-cols-[minmax(0,1.5fr)_1fr_1fr_1fr] gap-2 border-b bg-muted/35 px-3 py-2 text-[10px] font-semibold tracking-wide uppercase">
            <span>Teammate</span>
            <span className="text-right">Avg response</span>
            <span className="text-right">Handled</span>
            <span className="text-right">Response rate</span>
          </div>
          <ul>
            {scoreboard.rows.map((row, idx) => {
              const top = row.staffUserId === scoreboard.topPerformerStaffUserId;
              return (
                <li
                  key={row.staffUserId}
                  className={cn(
                    "grid grid-cols-[minmax(0,1.5fr)_1fr_1fr_1fr] items-center gap-2 border-t px-3 py-2.5 text-[12px] first:border-t-0",
                    top && "bg-emerald-500/8"
                  )}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <Badge
                      variant={top ? "default" : "secondary"}
                      className="h-5 shrink-0 px-1.5 text-[10px] tabular-nums"
                    >
                      #{idx + 1}
                    </Badge>
                    <span className="truncate font-medium">{row.displayName}</span>
                    {top ? (
                      <Badge
                        variant="outline"
                        className="border-emerald-300/80 bg-emerald-50 text-[10px] text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-50"
                      >
                        Top performer
                      </Badge>
                    ) : null}
                  </div>
                  <span className="text-right font-semibold tabular-nums">
                    {row.avgResponseLabel ?? "—"}
                  </span>
                  <span className="text-right font-semibold tabular-nums">
                    {row.conversationsHandled}
                  </span>
                  <span className="text-right font-semibold tabular-nums">
                    {row.responseRateLabel}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      <p className="text-muted-foreground text-[9px] leading-relaxed">
        Response rate = percent of measured customer-to-staff responses sent within 15 minutes.
      </p>
    </div>
  );
}

function LeadOffersAnalyticsSection({
  leadOffers,
  reportingLabel,
}: {
  leadOffers: DealershipLeadOfferAnalytics;
  reportingLabel: string;
}) {
  const { totals, byOffer } = leadOffers;
  const completionLabel =
    totals.completionRate !== null ? `${totals.completionRate}%` : "—";

  return (
    <div className="space-y-5">
      <AnalyticsSectionHeader
        eyebrow="Lead generation"
        title="Lead offers"
        description="AI mentions, customer engagement, completions, and attributed leads from active offers."
        aside={
          <>
            <Megaphone className="text-muted-foreground size-3 shrink-0" aria-hidden />
            <span className="text-muted-foreground/85">{reportingLabel}</span>
          </>
        }
      />
      <div className="grid auto-rows-fr gap-3 sm:grid-cols-2 sm:gap-3.5 xl:grid-cols-4">
        <KpiCard
          kind="volume"
          label="Offer views"
          value={totals.views}
          numericValue={totals.views}
          hint="Times the AI naturally mentioned an offer in chat."
        />
        <KpiCard
          kind="volume"
          label="Offer starts"
          value={totals.starts}
          numericValue={totals.starts}
          hint="Customer replied after an offer was mentioned."
        />
        <KpiCard
          kind="success"
          label="Completion rate"
          value={completionLabel}
          numericValue={totals.completionRate ?? 0}
          hint="Completes ÷ starts when customers engaged after an offer."
        />
        <KpiCard
          kind="success"
          label="Generated leads"
          value={totals.leads}
          numericValue={totals.leads}
          hint="Contact captured or handoff after an attributed offer."
        />
      </div>
      {byOffer.length > 0 ? (
        <div
          className={cn(
            "text-card-foreground overflow-hidden rounded-md",
            cardElevationClassName
          )}
        >
          <div className={cardPanelHeaderClassName}>
            <p className="text-foreground text-sm font-semibold">By offer</p>
          </div>
          <div className={cn(cardPanelBodyClassName, "overflow-x-auto")}>
            <table className="w-full min-w-[32rem] text-left text-[11px]">
              <thead>
                <tr className="text-muted-foreground border-border border-b">
                  <th className="pb-2 pr-3 font-medium">Offer</th>
                  <th className="pb-2 pr-3 text-right font-medium tabular-nums">Views</th>
                  <th className="pb-2 pr-3 text-right font-medium tabular-nums">Starts</th>
                  <th className="pb-2 pr-3 text-right font-medium tabular-nums">Complete %</th>
                  <th className="pb-2 text-right font-medium tabular-nums">Leads</th>
                </tr>
              </thead>
              <tbody>
                {byOffer.map((row) => (
                  <tr key={row.offerId} className="border-border/60 border-b last:border-0">
                    <td className="text-foreground py-2 pr-3 font-medium">{row.offerName}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{row.views}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{row.starts}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">
                      {row.completionRate !== null ? `${row.completionRate}%` : "—"}
                    </td>
                    <td className="py-2 text-right tabular-nums">{row.leads}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">
          No offer activity yet. Create active offers in{" "}
          <Link href="/settings/lead-offers" className="text-primary font-medium hover:underline">
            Settings → Lead offers
          </Link>
          .
        </p>
      )}
    </div>
  );
}

export function AnalyticsDashboard({
  data,
  staffUserId,
  canDrillTeammateAssignees,
}: {
  data: DealershipAnalyticsSnapshot;
  staffUserId: string;
  canDrillTeammateAssignees: boolean;
}) {
  const { snapshot, period, reportingPeriod, assignmentLoad } = data;
  const days = reportingPeriod.days;

  const unassigned = assignmentLoad.find((r) => r.staffUserId === null)?.openAssigned ?? 0;
  const mine =
    assignmentLoad.find((r) => r.staffUserId === staffUserId)?.openAssigned ?? 0;

  const openHint =
    snapshot.openConversations === 0
      ? "Nothing waiting — share your widget link or send a test SMS to see traffic here."
      : "Active conversations in open, pending, or human handoff states.";

  const completedHint =
    "Closed, resolved, or archived (spam excluded) — lifetime totals for this dealership.";

  const frHint =
    period.conversationsWithMeasuredFirstReply > 0
      ? `${reportingPeriod.label} · ${period.conversationsWithMeasuredFirstReply} threads with a measured first reply`
      : `${reportingPeriod.label} · add replies in the inbox to unlock this benchmark`;

  const newHint = `${period.conversationsStarted} conversations created in the last ${days} days`;

  return (
    <div>
      <AnalyticsMajorSection>
        <div className="space-y-5">
          <AnalyticsSectionHeader
            eyebrow="Performance"
            title="Operational pulse"
            description="The headline metrics leadership checks first — queue, outcomes, speed, and new volume."
            aside={
              <>
                <BarChart3 className="text-muted-foreground size-3 shrink-0" aria-hidden />
                <span className="text-foreground font-semibold tabular-nums">{days}d</span>
                <span className="text-muted-foreground/80">window</span>
              </>
            }
          />
          <div className="grid auto-rows-fr gap-3 sm:grid-cols-2 sm:gap-3.5 xl:grid-cols-4">
            <KpiCard
              kind="queue"
              label="Open queue"
              value={snapshot.openConversations}
              numericValue={snapshot.openConversations}
              hint={openHint}
              footnote={
                period.conversationsStarted > 0
                  ? `${period.conversationsStarted} new in last ${days}d`
                  : undefined
              }
            />
            <KpiCard
              kind="success"
              label="Completed"
              value={snapshot.completedConversations}
              numericValue={snapshot.completedConversations}
              hint={completedHint}
            />
            <KpiCard
              kind="time"
              label="Avg. first response"
              value={period.avgFirstResponseLabel ?? "—"}
              numericValue={period.avgFirstResponseSeconds ?? 0}
              hint={frHint}
            />
            <KpiCard
              kind="volume"
              label="New conversations"
              value={period.conversationsStarted}
              numericValue={period.conversationsStarted}
              hint={newHint}
            />
          </div>
        </div>
      </AnalyticsMajorSection>

      <AnalyticsMajorSection>
        <LiveQueueSection
          humanReviewCount={data.openWithActiveSentimentFlag}
          mineCount={mine}
          unassignedCount={unassigned}
        />
      </AnalyticsMajorSection>

      <AnalyticsMajorSection>
        <TeamPerformanceScoreboard scoreboard={data.teamScoreboard} />
      </AnalyticsMajorSection>

      <AnalyticsMajorSection>
        <LeadOffersAnalyticsSection
          leadOffers={data.leadOffers}
          reportingLabel={reportingPeriod.label}
        />
      </AnalyticsMajorSection>

      <AnalyticsMajorSection>
        <div className="space-y-5">
          <AnalyticsSectionHeader
            eyebrow="Distribution"
            title="Breakdowns"
            description="Where new conversations start and how they split by department and channel."
            aside={
              <span className="text-muted-foreground/85">
                <span className="text-foreground font-medium">{reportingPeriod.label}</span>
              </span>
            }
          />
          <div className="grid gap-3 lg:grid-cols-2">
            <InsightBarBlock
              title="By department"
              description={`Share of new conversations in ${reportingPeriod.label.toLowerCase()}.`}
              rows={period.byDepartment}
              formatLabel={(k) => formatDepartmentLabel(k as StaffDepartment)}
              emptyCta={{
                label: "Open inbox",
                href: buildInboxHref("all_open"),
                hint: "When customers message you, department splits appear here automatically from routing rules.",
              }}
            />
            <InsightBarBlock
              title="By channel"
              description={`SMS, web chat, and more — ${reportingPeriod.label.toLowerCase()}.`}
              rows={period.byChannel}
              formatLabel={(k) => formatChannelLabel(k as ConversationChannel)}
              emptyCta={{
                label: "Create a test conversation",
                href: buildInboxHref("all_open"),
                hint: "Embed the web widget or send an SMS to your Twilio number to see channel mix.",
              }}
            />
          </div>
        </div>
      </AnalyticsMajorSection>

      <AnalyticsMajorSection>
        <div className="space-y-5">
          <AnalyticsSectionHeader
            eyebrow="Operations"
            title="Quality & assignment"
            description="After-hours intake, sentiment load, and who owns what in the open queue right now."
          />
          <div className="grid gap-3 lg:grid-cols-2">
        <div className={cardPanelClassName}>
          <div className={cn(cardPanelHeaderClassName, "items-start gap-2 py-1.5")}>
            <Sparkles
              className="text-muted-foreground mt-0.5 size-3.5 shrink-0 opacity-90"
              aria-hidden
            />
            <div className="min-w-0 space-y-1">
              <h3 className="text-foreground text-[13px] font-bold tracking-[-0.025em]">
                After-hours & sentiment
              </h3>
              <p className="text-muted-foreground/80 text-[10px] font-normal leading-relaxed">
                Intake quality and risk signals across the same reporting window.
              </p>
            </div>
          </div>
          <ul className={cn(cardPanelBodyClassName, "space-y-1.5 px-2.5 py-2.5 text-[13px]")}>
            <li className="bg-muted/25 flex items-baseline justify-between gap-3 rounded-md px-2.5 py-2">
              <span className="text-muted-foreground text-[11px] font-normal leading-snug">
                After-hours web chat intake
              </span>
              <span className="text-foreground text-[1.625rem] font-bold tabular-nums tracking-tight">
                {period.afterHoursConversations}
              </span>
            </li>
            <li className="bg-muted/25 flex items-baseline justify-between gap-3 rounded-md px-2.5 py-2">
              <span className="text-muted-foreground text-[11px] font-normal leading-snug">
                Sentiment escalations (distinct)
              </span>
              <span className="text-foreground text-[1.625rem] font-bold tabular-nums tracking-tight">
                {period.sentimentEscalationEvents}
              </span>
            </li>
            <li className="bg-muted/25 flex items-baseline justify-between gap-3 rounded-md px-2.5 py-2">
              <span className="text-muted-foreground text-[11px] font-normal leading-snug">
                Open · active sentiment flag
              </span>
              <span className="text-foreground text-[1.625rem] font-bold tabular-nums tracking-tight">
                {data.openWithActiveSentimentFlag}
              </span>
            </li>
          </ul>
        </div>

        <div className={cardPanelClassName}>
          <div className={cn(cardPanelHeaderClassName, "items-start py-1.5")}>
            <div className="min-w-0 space-y-1">
              <h3 className="text-foreground text-[13px] font-bold tracking-[-0.025em]">Assignment load</h3>
              <p className="text-muted-foreground/80 text-[10px] font-normal leading-relaxed">
                Ownership across the active queue — rebalance when someone is underwater.
              </p>
            </div>
          </div>
          {assignmentLoad.length === 0 ? (
            <div className="bg-muted/35 mx-3 mb-3 rounded-md px-3 py-4">
              <p className="text-foreground text-[13px] font-semibold tracking-tight">No open conversations</p>
              <p className="text-muted-foreground mt-1 text-[11px] font-normal leading-relaxed">
                When the queue fills, you will see load by teammate here.
              </p>
              <Link
                href={buildInboxHref("all_open")}
                className={cn(buttonVariants({ size: "sm" }), "mt-3 inline-flex gap-1.5")}
              >
                Go to inbox
                <ArrowRight className="size-3.5" aria-hidden />
              </Link>
            </div>
          ) : (
            <ul className={cn(cardPanelBodyClassName, "space-y-1.5 px-2.5 py-2.5")}>
              {assignmentLoad.map((row) => {
                const key = row.staffUserId ?? "unassigned";
                const rowClass =
                  "text-foreground flex items-center justify-between gap-3 rounded-md px-2.5 py-1.5 text-[13px] transition-colors";
                const label = (
                  <>
                    <span className="text-foreground text-[12px] font-medium">{row.displayName}</span>
                    <Badge variant="secondary" className="tabular-nums text-[12px] font-bold">
                      {row.openAssigned}
                    </Badge>
                  </>
                );

                if (row.staffUserId === null) {
                  return (
                    <li key={key}>
                      <Link
                        href={buildInboxHref("unassigned")}
                        scroll={false}
                        className={cn(
                          rowClass,
                          "hover:bg-muted/30 focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-0 focus-visible:outline-none"
                        )}
                      >
                        {label}
                      </Link>
                    </li>
                  );
                }

                const teammateHref = canDrillTeammateAssignees
                  ? buildInboxHref("all_open", { ownerUserId: row.staffUserId })
                  : row.staffUserId === staffUserId
                    ? buildInboxHref("mine")
                    : null;

                if (teammateHref) {
                  return (
                    <li key={key}>
                      <Link
                        href={teammateHref}
                        scroll={false}
                        className={cn(
                          rowClass,
                          "hover:bg-muted/30 focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-0 focus-visible:outline-none"
                        )}
                      >
                        {label}
                      </Link>
                    </li>
                  );
                }

                return (
                  <li
                    key={key}
                    className={cn(rowClass, "cursor-default")}
                    title="Managers and admins can open a teammate's queue from here. Use My customers in the inbox for your own threads."
                  >
                    {label}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
          </div>
        </div>
      </AnalyticsMajorSection>

      <AnalyticsMajorSection>
        <details
          className={cn(
            cardPanelClassName,
            "group bg-muted/15 transition-colors hover:bg-muted/25"
          )}
        >
          <summary
            className={cn(
              cardPanelHeaderClassName,
              "cursor-pointer list-none hover:bg-muted/40"
            )}
          >
            <span className="text-foreground inline-flex items-center gap-2 text-[13px] font-bold tracking-[-0.02em]">
              <Sparkles className="text-muted-foreground size-3.5 shrink-0 opacity-90" aria-hidden />
              How we calculate these metrics
            </span>
            <span className="text-muted-foreground text-[9px] font-semibold tracking-wide uppercase group-open:hidden">
              Show
            </span>
            <span className="text-muted-foreground hidden text-[9px] font-semibold tracking-wide uppercase group-open:inline">
              Hide
            </span>
          </summary>
          <div className="text-muted-foreground bg-muted/25 space-y-1.5 px-3 py-3 text-[10px] font-normal leading-relaxed">
          <p>
            All counts respect dealership boundaries (RLS). Rolling window:{" "}
            <span className="text-foreground/90 font-semibold">{reportingPeriod.days} days</span> ending{" "}
            <span className="text-foreground/90 font-semibold">{data.generatedAtIso}</span>.
          </p>
          <p>
            First response time is the elapsed seconds from the first inbound{" "}
            <em>customer</em> message to the first <em>staff</em> message after it in the same
            conversation (system/AI messages before the first customer message are skipped).
            Department and channel charts count conversations <em>created</em> in the window.
          </p>
          <p>
            Export hooks and benchmark columns (e.g. vs Podium) can be layered on this snapshot
            shape without changing definitions.
          </p>
          </div>
        </details>
      </AnalyticsMajorSection>
    </div>
  );
}
