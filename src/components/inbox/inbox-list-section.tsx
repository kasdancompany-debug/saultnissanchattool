import type { InboxSort } from "@/lib/inbox/inbox-sort";
import type { InboxFilter } from "@/server/data/inbox";
import { loadInboxConversationList } from "@/server/inbox/inbox-loaders";

import { ConversationListPanel } from "./conversation-list-panel";
import { InboxErrorPanel } from "./inbox-error-panel";
import { inboxListSubtitle } from "./inbox-labels";

export async function InboxListSection({
  dealershipId,
  filter,
  sort,
  staffUserId,
  canViewDealershipWide,
  assigneeScopeUserId,
  selectedConversationId,
  widgetHref,
  canDeleteForever,
}: {
  dealershipId: string;
  filter: InboxFilter;
  sort: InboxSort;
  staffUserId: string;
  canViewDealershipWide: boolean;
  assigneeScopeUserId: string | null;
  selectedConversationId: string | null;
  widgetHref: string;
  canDeleteForever: boolean;
}) {
  const listRes = await loadInboxConversationList(
    dealershipId,
    filter,
    staffUserId,
    canViewDealershipWide,
    assigneeScopeUserId,
    sort
  );

  if (!listRes.ok) {
    return (
      <aside className="relative z-[1] flex min-h-0 w-full min-w-[320px] max-w-[440px] flex-col bg-muted/25 shadow-[8px_0_40px_-14px_rgba(15,23,42,0.12),4px_0_24px_-16px_rgba(15,23,42,0.08),inset_1px_0_0_rgba(15,23,42,0.04)] dark:bg-muted/15 dark:shadow-[8px_0_44px_-12px_rgba(0,0,0,0.55),inset_1px_0_0_rgba(255,255,255,0.04)]">
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
      filter={filter}
      sort={sort}
      assigneeScopeUserId={assigneeScopeUserId}
      selectedConversationId={selectedConversationId}
      currentStaffUserId={staffUserId}
      widgetHref={widgetHref}
      emptyHint={inboxListSubtitle(filter)}
      canDeleteForever={canDeleteForever}
    />
  );
}
