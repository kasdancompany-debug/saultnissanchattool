"use client";

import { useRouter } from "next/navigation";
import { ArrowDownWideNarrow } from "lucide-react";

import {
  INBOX_SORT_OPTIONS,
  inboxSortLabel,
  type InboxSort,
} from "@/lib/inbox/inbox-sort";
import type { InboxFilter } from "@/lib/inbox/inbox-filter";

import { buildInboxHref } from "./inbox-params";

export function InboxSortSelect({
  sort,
  filter,
  assigneeScopeUserId,
  selectedConversationId,
}: {
  sort: InboxSort;
  filter: InboxFilter;
  assigneeScopeUserId: string | null;
  selectedConversationId: string | null;
}) {
  const router = useRouter();

  return (
    <label className="text-muted-foreground flex min-w-0 items-center gap-1.5 text-[10px] font-medium">
      <ArrowDownWideNarrow className="size-3 shrink-0 opacity-70" aria-hidden />
      <span className="sr-only sm:not-sr-only sm:inline">Sort</span>
      <select
        value={sort}
        onChange={(e) => {
          const next = e.target.value as InboxSort;
          if (!INBOX_SORT_OPTIONS.includes(next)) return;
          router.push(
            buildInboxHref(filter, {
              conversationId: selectedConversationId,
              ownerUserId: assigneeScopeUserId,
              sort: next,
            })
          );
        }}
        className="border-input bg-background text-foreground h-7 max-w-[9.5rem] truncate rounded-md border px-2 text-[10px] font-semibold shadow-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/55"
        aria-label="Sort conversations"
      >
        {INBOX_SORT_OPTIONS.map((opt) => (
          <option key={opt} value={opt}>
            {inboxSortLabel(opt)}
          </option>
        ))}
      </select>
    </label>
  );
}
