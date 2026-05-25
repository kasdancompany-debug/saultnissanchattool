import { Suspense } from "react";

import { InboxRealtimeBridge } from "@/components/inbox/inbox-realtime-bridge";
import { ConversationListSkeleton } from "@/components/inbox/conversation-list-skeleton";
import { InboxListSection } from "@/components/inbox/inbox-list-section";
import { InboxOrphanSlot } from "@/components/inbox/inbox-orphan-slot";
import { InboxOrphanSlotSkeleton } from "@/components/inbox/inbox-orphan-slot-skeleton";
import { InboxPageShell } from "@/components/inbox/inbox-page-shell";
import { InboxSelectConversationEmpty } from "@/components/inbox/inbox-select-conversation-empty";
import { InboxThreadLoader } from "@/components/inbox/inbox-thread-loader";
import { InboxThreadSkeleton } from "@/components/inbox/inbox-thread-skeleton";
import {
  canViewDealershipWideInbox,
  normalizeInboxFilterForRole,
} from "@/lib/inbox/filter-access";
import { resolveInboxAssigneeScopeForFilter } from "@/components/inbox/inbox-params";
import type { InboxSort } from "@/lib/inbox/inbox-sort";
import type { InboxFilter } from "@/server/data/inbox";
import { EMPTY_INBOX_QUEUE_COUNTS } from "@/lib/inbox/compute-queue-counts";
import { requireStaff } from "@/server/auth/staff";
import { getInboxQueueCounts } from "@/server/data/inbox-queue-counts";
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

  const countsRes = await getInboxQueueCounts(
    staff.dealership_id,
    staff.id,
    canViewDealershipWide
  );
  const initialQueueCounts = countsRes.ok ? countsRes.data : EMPTY_INBOX_QUEUE_COUNTS;

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
        <Suspense fallback={<InboxOrphanSlotSkeleton />}>
          <InboxOrphanSlot
            dealershipId={staff.dealership_id}
            filter={effectiveFilter}
            sort={sort}
            staffUserId={staff.id}
            canViewDealershipWide={canViewDealershipWide}
            assigneeScopeUserId={assigneeScopeUserId}
            selectedConversationId={selectedConversationId}
          />
        </Suspense>

        <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
          <Suspense fallback={<ConversationListSkeleton />}>
            <InboxListSection
              dealershipId={staff.dealership_id}
              filter={effectiveFilter}
              sort={sort}
              staffUserId={staff.id}
              canViewDealershipWide={canViewDealershipWide}
              assigneeScopeUserId={assigneeScopeUserId}
              selectedConversationId={selectedConversationId}
              widgetHref={widgetHref}
              canDeleteForever={canManageAssignments}
            />
          </Suspense>

          {selectedConversationId ? (
            <Suspense fallback={<InboxThreadSkeleton />}>
              <InboxThreadLoader
                dealershipId={staff.dealership_id}
                conversationId={selectedConversationId}
                currentStaffUserId={staff.id}
                canManageAssignments={canManageAssignments}
              />
            </Suspense>
          ) : (
            <InboxSelectConversationEmpty widgetHref={widgetHref} />
          )}
        </div>
      </InboxPageShell>
    </InboxRealtimeBridge>
  );
}
