import type { InboxFilter } from "@/lib/inbox/inbox-filter";
import { parseInboxSort, type InboxSort } from "@/lib/inbox/inbox-sort";

export { parseInboxSort, type InboxSort };

const VALID: InboxFilter[] = [
  "all_open",
  "mine",
  "unassigned",
  "sales",
  "service",
  "closed",
];

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseInboxFilter(raw: string | undefined): InboxFilter {
  if (raw && VALID.includes(raw as InboxFilter)) {
    return raw as InboxFilter;
  }
  return "all_open";
}

/** `owner` search param: narrow open-queue tabs to a specific assignee (managers/admins). */
export function parseInboxOwnerUserId(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const t = raw.trim();
  if (!t || !UUID_RE.test(t)) return null;
  return t;
}

/**
 * Assignee scope applies only to open-queue tabs that support dealership-wide narrowing.
 * Non–dealership-wide roles cannot scope to another teammate's queue.
 */
export function resolveInboxAssigneeScopeForFilter(
  effectiveFilter: InboxFilter,
  ownerParam: string | undefined,
  staffUserId: string,
  canViewDealershipWide: boolean
): string | null {
  if (
    effectiveFilter !== "all_open" &&
    effectiveFilter !== "sales" &&
    effectiveFilter !== "service"
  ) {
    return null;
  }
  const parsed = parseInboxOwnerUserId(ownerParam);
  if (!parsed) return null;
  if (canViewDealershipWide) return parsed;
  if (parsed === staffUserId) return parsed;
  return null;
}

export type BuildInboxHrefOptions = {
  conversationId?: string | null;
  ownerUserId?: string | null;
  sort?: InboxSort;
};

/**
 * When switching tabs, keep `owner` only for views where the server applies assignee scope.
 */
export function ownerUserIdForInboxTab(
  nextFilter: InboxFilter,
  currentOwnerUserId: string | null
): string | null {
  if (
    nextFilter === "all_open" ||
    nextFilter === "sales" ||
    nextFilter === "service"
  ) {
    return currentOwnerUserId;
  }
  return null;
}

export function buildInboxHref(
  filter: InboxFilter,
  conversationIdOrOptions?: string | null | BuildInboxHrefOptions
): string {
  let conversationId: string | null | undefined;
  let ownerUserId: string | null | undefined;
  let sort: InboxSort | undefined;
  if (
    conversationIdOrOptions != null &&
    typeof conversationIdOrOptions === "object"
  ) {
    conversationId = conversationIdOrOptions.conversationId;
    ownerUserId = conversationIdOrOptions.ownerUserId;
    sort = conversationIdOrOptions.sort;
  } else {
    conversationId = conversationIdOrOptions ?? undefined;
  }

  const p = new URLSearchParams();
  p.set("filter", filter);
  if (conversationId) {
    p.set("c", conversationId);
  }
  const owner = ownerUserId?.trim();
  if (owner) {
    p.set("owner", owner);
  }
  if (sort) {
    p.set("sort", sort);
  }
  return `/inbox?${p.toString()}`;
}

export function buildInboxConversationHref(
  filter: InboxFilter,
  conversationId: string,
  ownerUserId?: string | null,
  sort?: InboxSort
): string {
  return buildInboxHref(filter, {
    conversationId,
    ownerUserId: ownerUserId ?? undefined,
    sort,
  });
}
