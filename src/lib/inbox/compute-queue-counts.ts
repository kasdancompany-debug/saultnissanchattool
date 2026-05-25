import type { ConversationStatus } from "@/integrations/supabase/database.types";
import {
  COMPLETED_CONVERSATION_STATUSES,
  OPEN_QUEUE_STATUSES,
} from "@/lib/conversation/status-sets";

export type InboxQueueCounts = {
  allOpen: number;
  unassigned: number;
  waitingHuman: number;
  mine: number;
  sales: number;
  service: number;
  closed: number;
};

export const EMPTY_INBOX_QUEUE_COUNTS: InboxQueueCounts = {
  allOpen: 0,
  unassigned: 0,
  waitingHuman: 0,
  mine: 0,
  sales: 0,
  service: 0,
  closed: 0,
};

type OpenRow = {
  status: string;
  assigned_to_user_id: string | null;
  department: string | null;
};

export function computeInboxQueueCountsFromRows(
  openRows: OpenRow[],
  closedCount: number,
  staffUserId: string,
  includeDealershipWide: boolean
): InboxQueueCounts {
  let allOpen = 0;
  let unassigned = 0;
  let waitingHuman = 0;
  let mine = 0;
  let sales = 0;
  let service = 0;

  for (const row of openRows) {
    if (!OPEN_QUEUE_STATUSES.includes(row.status as (typeof OPEN_QUEUE_STATUSES)[number])) {
      continue;
    }
    allOpen += 1;
    if (row.assigned_to_user_id == null) {
      unassigned += 1;
    }
    if (row.status === "waiting_for_human") {
      waitingHuman += 1;
    }
    if (row.assigned_to_user_id === staffUserId) {
      mine += 1;
    }
    if (row.department === "sales") {
      sales += 1;
    } else if (row.department === "service") {
      service += 1;
    }
  }

  return {
    allOpen: includeDealershipWide ? allOpen : mine + unassigned,
    unassigned,
    waitingHuman: includeDealershipWide ? waitingHuman : 0,
    mine,
    sales: includeDealershipWide ? sales : 0,
    service: includeDealershipWide ? service : 0,
    closed: includeDealershipWide ? closedCount : 0,
  };
}

export function openStatusesForInboxCounts(): ConversationStatus[] {
  return [...OPEN_QUEUE_STATUSES];
}

export function closedStatusesForInboxCounts(): ConversationStatus[] {
  return [...COMPLETED_CONVERSATION_STATUSES];
}
