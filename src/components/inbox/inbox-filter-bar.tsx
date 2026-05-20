import Link from "next/link";

import { cn } from "@/lib/utils";
import type { InboxFilter } from "@/server/data/inbox";

import { buildInboxHref } from "./inbox-params";
import { filterTabLabel } from "./inbox-labels";

const FILTERS: InboxFilter[] = [
  "all_open",
  "mine",
  "unassigned",
  "sales",
  "service",
  "closed",
];

export function InboxFilterBar({
  active,
  selectedConversationId,
}: {
  active: InboxFilter;
  /** Preserved across filter changes so the open thread stays selected when still valid. */
  selectedConversationId: string | null;
}) {
  return (
    <div className="bg-background/96 flex flex-wrap items-center gap-2 px-4 py-2.5 shadow-[0_6px_18px_-12px_rgba(15,23,42,0.06)] backdrop-blur-md sm:px-5">
      <span className="text-muted-foreground mr-1 text-xs font-medium tracking-wide uppercase">
        View
      </span>
      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => {
          const isActive = f === active;
          return (
            <Link
              key={f}
              href={buildInboxHref(f, selectedConversationId)}
              scroll={false}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium transition-[background-color,color,border-color,box-shadow] duration-150 ease-out motion-reduce:transition-none",
                isActive
                  ? "border-primary/25 bg-primary/10 text-foreground shadow-sm"
                  : "border-transparent bg-muted/22 text-muted-foreground hover:bg-muted/48 hover:text-foreground hover:shadow-sm"
              )}
            >
              {filterTabLabel(f)}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
