import "server-only";

import { cache } from "react";

import type { InboxSort } from "@/lib/inbox/inbox-sort";
import {
  getInboxThread,
  listInboxConversations,
  type InboxFilter,
} from "@/server/data/inbox";
import { listActiveStaffByDealership } from "@/server/data/staff-users";

/**
 * Per-request deduplicated inbox queries (React cache).
 * Safe for auth-scoped data: each RSC request runs in the caller's context.
 */
export const loadInboxConversationList = cache(
  async (
    dealershipId: string,
    filter: InboxFilter,
    staffUserId: string,
    canViewDealershipWide: boolean,
    assigneeScopeUserId: string | null,
    sort: InboxSort
  ) => {
    return listInboxConversations(
      dealershipId,
      filter,
      staffUserId,
      canViewDealershipWide,
      assigneeScopeUserId,
      sort
    );
  }
);

export const loadInboxThread = cache(
  async (dealershipId: string, conversationId: string) => {
    return getInboxThread(dealershipId, conversationId);
  }
);

export const loadInboxStaffDirectory = cache(async (dealershipId: string) => {
  return listActiveStaffByDealership(dealershipId);
});
