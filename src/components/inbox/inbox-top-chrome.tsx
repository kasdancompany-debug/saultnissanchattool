"use client";

import { startTransition, useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Activity, Radio, UserX, Users } from "lucide-react";

import type { StaffRole } from "@/integrations/supabase/database.types";
import { allowedInboxFiltersForRole, canViewDealershipWideInbox } from "@/lib/inbox/filter-access";
import type { InboxSort } from "@/lib/inbox/inbox-sort";
import type { InboxFilter } from "@/lib/inbox/inbox-filter";
import { cn } from "@/lib/utils";

import { Badge } from "@/components/ui/badge";

import { buildInboxHref, ownerUserIdForInboxTab } from "./inbox-params";
import { filterTabLabel, inboxOwnershipViewHint } from "./inbox-labels";
import type { InboxQueueCounts } from "@/lib/inbox/compute-queue-counts";
import { useInboxQueueCounts } from "./use-inbox-queue-counts";

function countForFilter(f: InboxFilter, c: InboxQueueCounts): number {
  switch (f) {
    case "all_open":
      return c.allOpen;
    case "mine":
      return c.mine;
    case "unassigned":
      return c.unassigned;
    case "sales":
      return c.sales;
    case "service":
      return c.service;
    case "closed":
      return c.closed;
    default:
      return 0;
  }
}

function badgeTone(tone: "amber" | "rose" | "emerald") {
  return cn(
    "min-w-[2rem] justify-center border tabular-nums font-semibold",
    tone === "amber" &&
      "border-amber-200/90 bg-amber-50 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/45 dark:text-amber-50",
    tone === "rose" &&
      "border-rose-200/90 bg-rose-50 text-rose-950 dark:border-rose-900/60 dark:bg-rose-950/45 dark:text-rose-50",
    tone === "emerald" &&
      "border-emerald-200/90 bg-emerald-50 text-emerald-950 dark:border-emerald-900/60 dark:bg-emerald-950/45 dark:text-emerald-50"
  );
}

function InboxStatusStrip({
  counts,
  loading,
}: {
  counts: InboxQueueCounts;
  loading: boolean;
}) {
  const display = (n: number) =>
    loading ? "—" : n > 99 ? "99+" : String(n);

  return (
    <div className="bg-muted/22 flex flex-wrap items-center gap-x-4 gap-y-1.5 px-5 py-2 sm:px-8">
      <div className="text-muted-foreground flex items-center gap-2 text-[9px] font-medium tracking-[0.12em] uppercase">
        <Radio className="text-muted-foreground size-3.5" aria-hidden />
        Queue snapshot
      </div>
      <div className="flex flex-wrap items-center gap-4 sm:gap-6">
        <Link
          href={buildInboxHref("unassigned")}
          scroll={false}
          className="flex items-center gap-2 rounded-md px-2.5 py-1.5 transition-[background-color,color,opacity] duration-150 ease-out hover:bg-background/85 focus-visible:ring-2 focus-visible:ring-ring/55 focus-visible:ring-offset-0 focus-visible:outline-none motion-reduce:transition-none"
        >
          <UserX className="text-muted-foreground size-3.5" aria-hidden />
          <span className="text-muted-foreground text-xs font-medium">Needs owner</span>
          <Badge variant="outline" className={badgeTone("amber")}>
            {display(counts.unassigned)}
          </Badge>
        </Link>
        <span className="bg-border hidden h-4 w-px sm:inline" aria-hidden />
        <Link
          href={buildInboxHref("all_open")}
          scroll={false}
          title="Open conversations waiting for a staff reply"
          className="flex items-center gap-2 rounded-md px-2.5 py-1.5 transition-[background-color,color,opacity] duration-150 ease-out hover:bg-background/85 focus-visible:ring-2 focus-visible:ring-ring/55 focus-visible:ring-offset-0 focus-visible:outline-none motion-reduce:transition-none"
        >
          <Users className="text-muted-foreground size-3.5" aria-hidden />
          <span className="text-muted-foreground text-xs font-medium">Needs human</span>
          <Badge variant="outline" className={badgeTone("rose")}>
            {display(counts.waitingHuman)}
          </Badge>
        </Link>
        <span className="bg-border hidden h-4 w-px sm:inline" aria-hidden />
        <Link
          href={buildInboxHref("all_open")}
          scroll={false}
          className="flex items-center gap-2 rounded-md px-2.5 py-1.5 transition-[background-color,color,opacity] duration-150 ease-out hover:bg-background/85 focus-visible:ring-2 focus-visible:ring-ring/55 focus-visible:ring-offset-0 focus-visible:outline-none motion-reduce:transition-none"
        >
          <Activity className="text-muted-foreground size-3.5" aria-hidden />
          <span className="text-muted-foreground text-xs font-medium">Active</span>
          <Badge variant="outline" className={badgeTone("emerald")}>
            {display(counts.allOpen)}
          </Badge>
        </Link>
      </div>
    </div>
  );
}

export function InboxTopChrome({
  dealershipId,
  staffUserId,
  staffRole,
  active,
  sort,
  assigneeScopeUserId,
  selectedConversationId,
  initialQueueCounts,
}: {
  dealershipId: string;
  staffUserId: string;
  staffRole: StaffRole;
  active: InboxFilter;
  sort: InboxSort;
  assigneeScopeUserId: string | null;
  selectedConversationId: string | null;
  initialQueueCounts?: InboxQueueCounts;
}) {
  const canViewAll = canViewDealershipWideInbox(staffRole);
  const visibleFilters = allowedInboxFiltersForRole(staffRole);
  const router = useRouter();
  const [isPending, startRouteTransition] = useTransition();
  const [optimisticActive, setOptimisticActive] = useState<InboxFilter>(active);
  const { counts, loading } = useInboxQueueCounts(
    dealershipId,
    staffUserId,
    45_000,
    canViewAll,
    initialQueueCounts
  );
  const ownerForHref = assigneeScopeUserId;
  const filterHrefs = useMemo(
    () =>
      visibleFilters.map((f) =>
        buildInboxHref(f, {
          conversationId: selectedConversationId,
          ownerUserId: ownerUserIdForInboxTab(f, ownerForHref),
          sort,
        })
      ),
    [selectedConversationId, visibleFilters, ownerForHref, sort]
  );

  useEffect(() => {
    setOptimisticActive(active);
  }, [active]);

  useEffect(() => {
    startTransition(() => {
      for (const href of filterHrefs) {
        router.prefetch(href);
      }
    });
  }, [router, filterHrefs]);

  const navigateToFilter = (nextFilter: InboxFilter) => {
    const href = buildInboxHref(nextFilter, {
      conversationId: selectedConversationId,
      ownerUserId: ownerUserIdForInboxTab(nextFilter, ownerForHref),
      sort,
    });
    setOptimisticActive(nextFilter);
    startRouteTransition(() => {
      router.replace(href, { scroll: false });
    });
  };

  return (
    <div className="shrink-0">
      {canViewAll ? <InboxStatusStrip counts={counts} loading={loading} /> : null}

      <div className="bg-background flex flex-col gap-0 shadow-[0_6px_20px_-14px_rgba(15,23,42,0.07)]" role="tablist" aria-label="Inbox views">
        <div className="scrollbar-none flex gap-0 overflow-x-auto px-2 pt-1 sm:px-4">
          {visibleFilters.map((f) => {
            const isActive = f === optimisticActive;
            const n = countForFilter(f, counts);
            const countLabel = loading ? "—" : n > 999 ? "999+" : String(n);
            return (
              <button
                key={f}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-busy={isPending && isActive ? true : undefined}
                onClick={() => navigateToFilter(f)}
                className={cn(
                  "relative shrink-0 rounded-t-md px-3.5 py-2 text-[13px] font-semibold transition-[background-color,color,opacity,transform,box-shadow] duration-150 ease-out focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-ring/55 focus-visible:ring-offset-0 focus-visible:outline-none motion-reduce:transition-none enabled:active:scale-[0.98] sm:px-4",
                  isActive
                    ? "bg-card text-foreground shadow-[0_1px_0_rgba(15,23,42,0.06)] ring-1 ring-inset ring-foreground/10"
                    : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                )}
              >
                <span className="flex items-center gap-2">
                  <span>{filterTabLabel(f)}</span>
                  <span
                    className={cn(
                      "rounded-md px-1.5 py-0.5 text-[11px] tabular-nums",
                      isActive
                        ? "bg-foreground/8 text-foreground"
                        : "bg-muted/80 text-muted-foreground"
                    )}
                  >
                    {countLabel}
                  </span>
                </span>
                {isActive ? (
                  <span
                    className="bg-foreground/25 absolute right-3 left-3 -bottom-px h-px rounded-full sm:right-4 sm:left-4"
                    aria-hidden
                  />
                ) : null}
              </button>
            );
          })}
        </div>
        <div className="from-border/50 via-border/25 relative h-px overflow-hidden bg-gradient-to-r to-transparent" aria-hidden>
          <span
            className={cn(
              "bg-foreground/15 absolute inset-y-0 left-0 w-24 transition-transform duration-500",
              isPending ? "translate-x-0 animate-pulse" : "-translate-x-full"
            )}
          />
        </div>
        <p className="text-muted-foreground/75 px-4 py-1.5 text-[10px] font-medium sm:px-6">
          {inboxOwnershipViewHint(optimisticActive)}
        </p>
      </div>
    </div>
  );
}
