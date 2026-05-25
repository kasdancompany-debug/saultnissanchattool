import Link from "next/link";
import { Clock } from "lucide-react";

import type { InboxFilter } from "@/lib/inbox/inbox-filter";
import {
  getCustomerDisplayName,
  type InboxConversationListItem,
} from "@/lib/inbox/inbox-list-item";
import type { InboxSort } from "@/lib/inbox/inbox-sort";
import { opportunityScoreBand } from "@/lib/opportunity/score-band";
import { inboxChannelSurfaceAccentBarClass } from "@/lib/conversation/inbox-channel-ux";
import { leadStatusPillClass, LEAD_STATUS_LABEL } from "@/lib/inbox/lead-status";
import { cn } from "@/lib/utils";

import { OpportunityScoreInline } from "./opportunity-score-inline";
import { buildInboxConversationHref } from "./inbox-params";

function sentimentClass(sentiment: InboxConversationListItem["sentiment"]): string {
  switch (sentiment) {
    case "positive":
      return "text-emerald-700 dark:text-emerald-300";
    case "negative":
      return "text-rose-700 dark:text-rose-300";
    case "neutral":
      return "text-muted-foreground";
    default:
      return "text-muted-foreground/80";
  }
}

const priorityShell = {
  high: cn(
    "border-emerald-500/35 bg-gradient-to-br from-emerald-500/[0.07] via-card to-card",
    "shadow-[0_0_0_1px_rgba(16,185,129,0.12),0_8px_28px_-8px_rgba(16,185,129,0.22)]",
    "motion-safe:animate-inbox-card-glow"
  ),
  medium: "border-border/70 bg-card hover:border-border",
  low: "border-border/55 bg-card/95 hover:border-border/80",
} as const;

export function ConversationListRow({
  item,
  filter,
  sort,
  assigneeScopeUserId,
  isSelected,
  bulkSelect,
}: {
  item: InboxConversationListItem;
  filter: InboxFilter;
  sort: InboxSort;
  assigneeScopeUserId: string | null;
  isSelected: boolean;
  currentStaffUserId: string;
  bulkSelect?: {
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
  };
}) {
  const name = getCustomerDisplayName(item.customers, item.title);
  const opportunity = item.opportunity;
  const band = opportunityScoreBand(opportunity.score);
  const ctx = item.card;
  const isHighPriority = band === "high";
  const isBulkChecked = Boolean(bulkSelect?.checked);

  return (
    <div
      className={cn(
        "group relative flex overflow-hidden rounded-lg border transition-[transform,box-shadow,border-color,background-color] duration-200 ease-out",
        priorityShell[band],
        isHighPriority && "motion-safe:hover:-translate-y-px",
        !isHighPriority && "hover:shadow-md",
        isSelected &&
          "border-foreground/20 bg-card shadow-[0_2px_12px_-4px_rgba(15,23,42,0.12)] ring-1 ring-foreground/8 dark:shadow-[0_2px_16px_-6px_rgba(0,0,0,0.45)]",
        isBulkChecked && !isSelected && "border-border/80 bg-muted/30"
      )}
    >
      {bulkSelect ? (
        <div
          className="flex shrink-0 items-center py-2.5 pl-2.5"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <input
            type="checkbox"
            className="border-input accent-foreground/80 focus-visible:ring-ring size-3.5 rounded border shadow-sm focus-visible:ring-2 focus-visible:outline-none"
            checked={bulkSelect.checked}
            onChange={(e) => bulkSelect.onCheckedChange(e.target.checked)}
            aria-label={`Select conversation with ${name}`}
          />
        </div>
      ) : null}
      <Link
        href={buildInboxConversationHref(filter, item.id, assigneeScopeUserId, sort)}
        scroll={false}
        className={cn(
          "relative block min-w-0 flex-1 overflow-hidden",
          "focus-visible:ring-2 focus-visible:ring-ring/55 focus-visible:outline-none motion-reduce:transition-none"
        )}
        aria-current={isSelected ? "true" : undefined}
      >
      <div
        className={cn(
          "absolute inset-y-0 left-0 w-[3px] opacity-80",
          inboxChannelSurfaceAccentBarClass(ctx.channelSurface),
          isSelected && "opacity-100",
          isHighPriority && "opacity-95"
        )}
        aria-hidden
      />

      <div className="flex flex-col gap-2 py-2.5 pr-3 pl-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-foreground truncate text-[13px] font-semibold tracking-[-0.02em]">
              {name}
            </p>
            <p className="text-muted-foreground mt-0.5 truncate text-[11px] font-medium leading-snug">
              {opportunity.intent_summary}
            </p>
          </div>

          <div className="flex shrink-0 flex-col items-end gap-1">
            <div className="flex items-center gap-1.5">
              <OpportunityScoreInline opportunity={opportunity} />
              {ctx.unreadCount > 0 ? (
                <span
                  className="bg-primary text-primary-foreground flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold tabular-nums"
                  aria-label={`${ctx.unreadCount} unread`}
                >
                  {ctx.unreadCount > 9 ? "9+" : ctx.unreadCount}
                </span>
              ) : null}
            </div>
            {ctx.responseTimerLabel && ctx.awaitingReply ? (
              <span
                className={cn(
                  "inline-flex items-center gap-0.5 text-[10px] font-semibold tabular-nums",
                  ctx.responseTimerSeconds !== null && ctx.responseTimerSeconds > 900
                    ? "text-amber-700 dark:text-amber-300"
                    : "text-muted-foreground"
                )}
                title="Time since last customer message"
              >
                <Clock className="size-3 shrink-0 opacity-70" aria-hidden />
                {ctx.responseTimerLabel}
              </span>
            ) : null}
          </div>
        </div>

        <div className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] font-medium">
          <span className="text-foreground/90">{ctx.sourceLabel}</span>
          <span className="opacity-35" aria-hidden>
            ·
          </span>
          <span>{ctx.departmentLabel}</span>
          <span className="opacity-35" aria-hidden>
            ·
          </span>
          <span
            className={cn(
              ctx.isUnassigned
                ? "text-amber-800 dark:text-amber-200"
                : ctx.ownerIsCurrentStaff
                  ? "text-emerald-800 dark:text-emerald-200"
                  : "text-foreground/80"
            )}
          >
            {ctx.ownerLabel}
          </span>
          <span className="opacity-35" aria-hidden>
            ·
          </span>
          <span
            className={cn(
              "rounded border px-1.5 py-px text-[9px] font-semibold tracking-[0.08em] uppercase",
              leadStatusPillClass(ctx.leadStatus)
            )}
          >
            {LEAD_STATUS_LABEL[ctx.leadStatus]}
          </span>
          <span className="opacity-35" aria-hidden>
            ·
          </span>
          <span className={cn("font-medium", sentimentClass(ctx.sentiment))}>
            {ctx.sentimentLabel}
          </span>
        </div>
      </div>
      </Link>
    </div>
  );
}
