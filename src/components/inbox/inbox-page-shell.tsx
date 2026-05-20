import type { ReactNode } from "react";

import type { StaffRole } from "@/integrations/supabase/database.types";
import type { InboxSort } from "@/lib/inbox/inbox-sort";
import type { InboxFilter } from "@/server/data/inbox";

import { InboxTopChrome } from "./inbox-top-chrome";
import { filterTabLabel } from "./inbox-labels";

export function InboxPageShell({
  dealershipId,
  staffUserId,
  staffRole,
  filter,
  assigneeScopeUserId,
  selectedConversationId,
  sort,
  children,
}: {
  dealershipId: string;
  staffUserId: string;
  staffRole: StaffRole;
  filter: InboxFilter;
  assigneeScopeUserId: string | null;
  selectedConversationId: string | null;
  sort: InboxSort;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <header className="relative z-10 shrink-0 bg-card px-4 py-3 shadow-[0_1px_0_rgba(15,23,42,0.05),0_10px_32px_-8px_rgba(15,23,42,0.14),0_24px_48px_-16px_rgba(15,23,42,0.08)] sm:px-6 sm:py-3.5 dark:shadow-[0_1px_0_rgba(0,0,0,0.45),0_12px_40px_-8px_rgba(0,0,0,0.65)]">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div className="max-w-2xl space-y-0.5">
            <p className="text-muted-foreground text-[8px] font-bold tracking-[0.16em] uppercase">
              Operations workspace
            </p>
            <h1 className="text-foreground text-[1.5rem] font-bold tracking-[-0.045em] sm:text-[1.75rem] lg:text-[1.875rem]">
              Inbox
            </h1>
            <p className="text-muted-foreground/72 text-[10px] font-medium leading-snug">
              Shared dealership SMS number + web chat with internal ownership per conversation.{" "}
              <span className="text-foreground font-semibold">{filterTabLabel(filter)}</span> view.
            </p>
          </div>
          <div className="text-muted-foreground hidden text-right text-[9px] leading-snug sm:block">
            <span className="text-foreground/90 text-[9px] font-bold tracking-tight">Live queue</span>
            <br />
            <span className="font-medium">Realtime updates active</span>
          </div>
        </div>
      </header>

      <InboxTopChrome
        active={filter}
        sort={sort}
        dealershipId={dealershipId}
        assigneeScopeUserId={assigneeScopeUserId}
        selectedConversationId={selectedConversationId}
        staffUserId={staffUserId}
        staffRole={staffRole}
      />

      {children}
    </div>
  );
}
