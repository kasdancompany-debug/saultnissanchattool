import type { ReactNode } from "react";

import { InboxRealtimeBridge } from "@/components/inbox/inbox-realtime-bridge";
import { ConversationListPanel } from "@/components/inbox/conversation-list-panel";
import { InboxErrorPanel } from "@/components/inbox/inbox-error-panel";
import { InboxPageShell } from "@/components/inbox/inbox-page-shell";
import { InboxSelectConversationEmpty } from "@/components/inbox/inbox-select-conversation-empty";
import { InboxThreadLoader } from "@/components/inbox/inbox-thread-loader";
import { inboxListSubtitle } from "@/components/inbox/inbox-labels";
import {
  canViewDealershipWideInbox,
  normalizeInboxFilterForRole,
} from "@/lib/inbox/filter-access";
import { resolveInboxAssigneeScopeForFilter } from "@/components/inbox/inbox-params";
import type { InboxSort } from "@/lib/inbox/inbox-sort";
import type { InboxFilter } from "@/lib/inbox/inbox-filter";
import { EMPTY_INBOX_QUEUE_COUNTS } from "@/lib/inbox/compute-queue-counts";
import { requireStaff } from "@/server/auth/staff";
import { getInboxQueueCounts } from "@/server/data/inbox-queue-counts";
import {
  loadInboxConversationList,
  loadInboxThread,
} from "@/server/inbox/inbox-loaders";
import { staffCanEditDealershipSettings } from "@/server/settings/staff-privilege";

export async function InboxAuthenticatedView({
  filter,
  sort,
  ownerParam,
  selectedConversationId,
}: {
  filter: InboxFilter;
  sort: InboxSort;
  ownerParam?: string;
  selectedConversationId: string | null;
}) {
  const staff = await requireStaff();
  const canManageAssignments = staffCanEditDealershipSettings(staff);
  const canViewDealershipWide = canViewDealershipWideInbox(staff.role);
  const effectiveFilter = normalizeInboxFilterForRole(filter, staff.role);
  const assigneeScopeUserId = resolveInboxAssigneeScopeForFilter(
    effectiveFilter,
    ownerParam,
    staff.id,
    canViewDealershipWide
  );
  const widgetSlug = staff.dealership.slug?.trim() || "sault-nissan";
  const widgetHref = `/widget?slug=${encodeURIComponent(widgetSlug)}`;

  const [countsRes, listRes] = await Promise.all([
    getInboxQueueCounts(staff.dealership_id, staff.id, canViewDealershipWide),
    loadInboxConversationList(
      staff.dealership_id,
      effectiveFilter,
      staff.id,
      canViewDealershipWide,
      assigneeScopeUserId,
      sort
    ),
  ]);

  const initialQueueCounts = countsRes.ok ? countsRes.data : EMPTY_INBOX_QUEUE_COUNTS;

  let orphanBanner: ReactNode = null;
  if (selectedConversationId) {
    const threadRes = await loadInboxThread(
      staff.dealership_id,
      selectedConversationId
    );
    const inList =
      listRes.ok &&
      listRes.data.some((c) => c.id === selectedConversationId);
    if (threadRes.ok && !inList) {
      orphanBanner = (
        <div
          className="border-amber-300/80 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-50 shrink-0 border-b px-6 py-2.5 text-center text-xs leading-relaxed"
          role="status"
        >
          This conversation is not in the current filter. Try{" "}
          <span className="font-medium">All Open</span> or switch views — the
          thread below is still loaded for your dealership.
        </div>
      );
    }
  }

  const listAside = (() => {
    if (!listRes.ok) {
      return (
        <aside className="relative z-[1] flex min-h-0 w-full min-w-[320px] max-w-[440px] flex-col bg-muted/25">
          <InboxErrorPanel
            title="Could not load conversations"
            description={listRes.error.message}
          />
        </aside>
      );
    }

    return (
      <ConversationListPanel
        items={listRes.data}
        filter={effectiveFilter}
        sort={sort}
        assigneeScopeUserId={assigneeScopeUserId}
        selectedConversationId={selectedConversationId}
        currentStaffUserId={staff.id}
        widgetHref={widgetHref}
        emptyHint={inboxListSubtitle(effectiveFilter)}
        canDeleteForever
      />
    );
  })();

  return (
    <InboxRealtimeBridge
      dealershipId={staff.dealership_id}
      selectedConversationId={selectedConversationId}
    >
      <InboxPageShell
        dealershipId={staff.dealership_id}
        staffUserId={staff.id}
        staffRole={staff.role}
        filter={effectiveFilter}
        assigneeScopeUserId={assigneeScopeUserId}
        selectedConversationId={selectedConversationId}
        sort={sort}
        initialQueueCounts={initialQueueCounts}
      >
        {orphanBanner}

        <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
          {listAside}

          {selectedConversationId ? (
            <InboxThreadLoader
              dealershipId={staff.dealership_id}
              conversationId={selectedConversationId}
              filter={effectiveFilter}
              sort={sort}
              assigneeScopeUserId={assigneeScopeUserId}
              currentStaffUserId={staff.id}
              canManageAssignments={canManageAssignments}
              canDeleteForever
            />
          ) : (
            <InboxSelectConversationEmpty widgetHref={widgetHref} />
          )}
        </div>
      </InboxPageShell>
    </InboxRealtimeBridge>
  );
}
