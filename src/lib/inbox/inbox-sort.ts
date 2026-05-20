import type { InboxConversationListItem } from "@/server/data/inbox";

export const INBOX_SORT_OPTIONS = [
  "highest_score",
  "newest",
  "unassigned",
  "longest_waiting",
  "department",
] as const;

export type InboxSort = (typeof INBOX_SORT_OPTIONS)[number];

export const DEFAULT_INBOX_SORT: InboxSort = "highest_score";

export function parseInboxSort(raw: string | undefined): InboxSort {
  if (raw && INBOX_SORT_OPTIONS.includes(raw as InboxSort)) {
    return raw as InboxSort;
  }
  return DEFAULT_INBOX_SORT;
}

export function inboxSortLabel(sort: InboxSort): string {
  switch (sort) {
    case "highest_score":
      return "Highest score";
    case "newest":
      return "Newest";
    case "unassigned":
      return "Unassigned";
    case "longest_waiting":
      return "Longest waiting";
    case "department":
      return "Department";
    default:
      return "Highest score";
  }
}

function activityMs(item: InboxConversationListItem): number {
  const iso =
    item.last_message_at ??
    item.last_message_preview?.created_at ??
    item.updated_at;
  const t = iso ? new Date(iso).getTime() : 0;
  return Number.isNaN(t) ? 0 : t;
}

export function applyInboxSort(
  items: InboxConversationListItem[],
  sort: InboxSort
): InboxConversationListItem[] {
  const copy = [...items];

  switch (sort) {
    case "highest_score":
      copy.sort((a, b) => {
        const ds = b.opportunity.score - a.opportunity.score;
        if (ds !== 0) return ds;
        return activityMs(b) - activityMs(a);
      });
      break;
    case "newest":
      copy.sort((a, b) => activityMs(b) - activityMs(a));
      break;
    case "unassigned":
      copy.sort((a, b) => {
        const au = a.assignee == null ? 1 : 0;
        const bu = b.assignee == null ? 1 : 0;
        if (bu !== au) return bu - au;
        const ds = b.opportunity.score - a.opportunity.score;
        if (ds !== 0) return ds;
        return activityMs(b) - activityMs(a);
      });
      break;
    case "longest_waiting":
      copy.sort((a, b) => {
        const aw = a.status === "waiting_for_human" ? 1 : 0;
        const bw = b.status === "waiting_for_human" ? 1 : 0;
        if (bw !== aw) return bw - aw;
        return activityMs(a) - activityMs(b);
      });
      break;
    case "department":
      copy.sort((a, b) => {
        const dd = a.department.localeCompare(b.department);
        if (dd !== 0) return dd;
        const ds = b.opportunity.score - a.opportunity.score;
        if (ds !== 0) return ds;
        return activityMs(b) - activityMs(a);
      });
      break;
    default:
      break;
  }

  return copy;
}
