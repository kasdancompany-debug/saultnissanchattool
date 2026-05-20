import type { StaffRole } from "@/integrations/supabase/database.types";
import type { InboxFilter } from "@/lib/inbox/inbox-filter";

const ADMIN_FILTERS: InboxFilter[] = [
  "all_open",
  "mine",
  "unassigned",
  "sales",
  "service",
  "closed",
];

const STAFF_FILTERS: InboxFilter[] = ["mine", "unassigned"];

export function canViewDealershipWideInbox(role: StaffRole): boolean {
  return role === "admin" || role === "manager";
}

export function allowedInboxFiltersForRole(role: StaffRole): InboxFilter[] {
  return canViewDealershipWideInbox(role) ? ADMIN_FILTERS : STAFF_FILTERS;
}

export function normalizeInboxFilterForRole(
  filter: InboxFilter,
  role: StaffRole
): InboxFilter {
  const allowed = allowedInboxFiltersForRole(role);
  return allowed.includes(filter) ? filter : allowed[0];
}
