import { Skeleton } from "@/components/ui/skeleton";

import { ConversationListSkeleton } from "./conversation-list-skeleton";
import { InboxThreadSkeleton } from "./inbox-thread-skeleton";

/**
 * Full inbox chrome + list + thread placeholders while the authenticated RSC tree resolves.
 */
export function InboxRouteSkeleton({ showThread }: { showThread: boolean }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <header className="relative z-10 shrink-0 bg-card px-4 py-3.5 shadow-[0_1px_0_rgba(15,23,42,0.05),0_10px_32px_-8px_rgba(15,23,42,0.14),0_24px_48px_-16px_rgba(15,23,42,0.08)] sm:px-6 sm:py-4 dark:shadow-[0_1px_0_rgba(0,0,0,0.45),0_12px_40px_-8px_rgba(0,0,0,0.65)]">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div className="max-w-2xl space-y-2">
            <Skeleton className="h-2.5 w-28 rounded-full" />
            <Skeleton className="h-8 w-36 max-w-[12rem] sm:h-9 sm:w-40" />
            <Skeleton className="h-3.5 w-full max-w-md" />
          </div>
          <div className="hidden flex-col items-end gap-1 sm:flex">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-32" />
          </div>
        </div>
      </header>

      <div className="bg-muted/22 flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2 sm:px-6">
        <Skeleton className="h-2.5 w-24 rounded-full opacity-70" />
        <div className="flex flex-wrap items-center gap-3 sm:gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-7 w-[7.5rem] rounded-md sm:w-32" />
          ))}
        </div>
      </div>

      <div className="bg-background px-2 pt-1 shadow-[0_6px_20px_-14px_rgba(15,23,42,0.07)] sm:px-4">
        <div className="scrollbar-none flex gap-1 overflow-x-auto pb-0">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton
              key={i}
              className="h-10 w-[5.75rem] shrink-0 rounded-t-md sm:w-28"
            />
          ))}
        </div>
        <Skeleton className="bg-border/80 h-px w-full" />
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
        <ConversationListSkeleton />
        {showThread ? (
          <InboxThreadSkeleton />
        ) : (
          <div className="bg-muted/10 flex min-h-0 min-w-0 flex-1 flex-col items-center justify-center px-6 py-10">
            <Skeleton className="mb-6 size-14 rounded-md" />
            <Skeleton className="h-5 w-48 max-w-full" />
            <Skeleton className="mt-2 h-3.5 w-full max-w-sm" />
            <Skeleton className="mt-8 h-9 w-full max-w-xs rounded-md" />
          </div>
        )}
      </div>
    </div>
  );
}
