import type { InboxSort } from "@/lib/inbox/inbox-sort";
import type { InboxFilter } from "@/server/data/inbox";
import {
  loadInboxConversationList,
  loadInboxThread,
} from "@/server/inbox/inbox-loaders";

/**
 * Shown when the selected thread is valid but not in the current filter list
 * (e.g. open thread while viewing Closed). Uses cached loaders — no extra DB round-trips vs a monolithic fetch.
 */
export async function InboxOrphanSlot({
  dealershipId,
  filter,
  sort,
  staffUserId,
  canViewDealershipWide,
  assigneeScopeUserId,
  selectedConversationId,
}: {
  dealershipId: string;
  filter: InboxFilter;
  sort: InboxSort;
  staffUserId: string;
  canViewDealershipWide: boolean;
  assigneeScopeUserId: string | null;
  selectedConversationId: string | null;
}) {
  if (!selectedConversationId) {
    return null;
  }

  const [listRes, threadRes] = await Promise.all([
    loadInboxConversationList(
      dealershipId,
      filter,
      staffUserId,
      canViewDealershipWide,
      assigneeScopeUserId,
      sort
    ),
    loadInboxThread(dealershipId, selectedConversationId),
  ]);

  if (!listRes.ok || !threadRes.ok) {
    return null;
  }

  const inList = listRes.data.some((c) => c.id === selectedConversationId);
  if (inList) {
    return null;
  }

  return (
    <div
      className="border-amber-300/80 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-50 shrink-0 border-b px-6 py-2.5 text-center text-xs leading-relaxed"
      role="status"
    >
      This conversation is not in the current filter. Try{" "}
      <span className="font-medium">All Open</span> or switch views — the thread
      below is still loaded for your dealership.
    </div>
  );
}
