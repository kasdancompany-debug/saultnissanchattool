import "server-only";

import type { StaffDepartment, Tables } from "@/integrations/supabase/database.types";
import type { InboxFilter } from "@/lib/inbox/inbox-filter";
import {
  COMPLETED_CONVERSATION_STATUSES,
  OPEN_QUEUE_STATUSES,
} from "@/lib/conversation/status-sets";
import { resolveDb } from "@/server/data/internal";
import { fromPostgrestError } from "@/server/data/postgrest-error";
import type { TypedSupabaseClient } from "@/server/db/server-client";
import { err, ok, type Result } from "@/server/result";

type ConversationRow = Tables<"conversations">;

/** Customer fields needed for inbox lists and headers (minimal join). */
export type ConversationCustomerEmbed = {
  id: string;
  display_name: string | null;
  email: string | null;
  phone_e164: string | null;
};

/** Assignee fields for list/detail (minimal join). */
export type ConversationAssigneeEmbed = {
  id: string;
  display_name: string;
  email: string;
};

/**
 * Conversation row plus embedded customer and assignee for display.
 * Omits heavy fields not needed for typical inbox lists (use raw row APIs if you need only IDs).
 */
export type ConversationListEntry = Pick<
  ConversationRow,
  | "id"
  | "dealership_id"
  | "customer_id"
  | "channel"
  | "department"
  | "status"
  | "priority"
  | "sentiment"
  | "ai_enabled"
  | "assigned_to_user_id"
  | "last_message_at"
  | "title"
  | "metadata"
  | "created_at"
  | "updated_at"
> & {
  customer: ConversationCustomerEmbed | null;
  assignee: ConversationAssigneeEmbed | null;
};

export type ConversationDetail = ConversationListEntry;

/**
 * Indexed-friendly filters: `dealership_id` first, then status set (`OPEN_QUEUE_STATUSES`),
 * then assignee predicate. Sort: `last_message_at DESC NULLS LAST`, `created_at DESC`.
 */
const LIST_LIMIT_DEFAULT = 100;
const LIST_LIMIT_MAX = 500;

/** PostgREST embed: only columns needed for UI (no full `staff_users` / `customers` rows). */
const CONVERSATION_LIST_SELECT = `
  id,
  dealership_id,
  customer_id,
  channel,
  department,
  status,
  priority,
  sentiment,
  ai_enabled,
  assigned_to_user_id,
  last_message_at,
  title,
  metadata,
  created_at,
  updated_at,
  customers (
    id,
    display_name,
    email,
    phone_e164
  ),
  staff_users!conversations_assigned_to_user_id_fkey (
    id,
    display_name,
    email
  )
`.trim();

function normalizeCustomerEmbed(raw: unknown): ConversationCustomerEmbed | null {
  if (raw == null) {
    return null;
  }
  const row = Array.isArray(raw) ? raw[0] : raw;
  if (
    row &&
    typeof row === "object" &&
    !Array.isArray(row) &&
    "id" in row &&
    typeof (row as { id: unknown }).id === "string"
  ) {
    const o = row as {
      id: string;
      display_name: string | null;
      email: string | null;
      phone_e164: string | null;
    };
    return {
      id: o.id,
      display_name: o.display_name,
      email: o.email,
      phone_e164: o.phone_e164,
    };
  }
  return null;
}

function normalizeAssigneeEmbed(raw: unknown): ConversationAssigneeEmbed | null {
  if (raw == null) {
    return null;
  }
  const row = Array.isArray(raw) ? raw[0] : raw;
  if (
    row &&
    typeof row === "object" &&
    !Array.isArray(row) &&
    "id" in row &&
    typeof (row as { id: unknown }).id === "string"
  ) {
    const o = row as { id: string; display_name: string; email: string };
    const email = o.email ?? "";
    return {
      id: o.id,
      display_name: o.display_name?.trim() || email,
      email,
    };
  }
  return null;
}

function mapListRow(
  raw: Record<string, unknown> & {
    customers?: unknown;
    staff_users?: unknown;
  }
): ConversationListEntry {
  const {
    customers: customersRaw,
    staff_users: staffRaw,
    ...rest
  } = raw;

  const base = rest as Omit<ConversationListEntry, "customer" | "assignee">;

  const assignedId = base.assigned_to_user_id;

  return {
    ...base,
    customer: normalizeCustomerEmbed(customersRaw),
    assignee:
      assignedId != null ? normalizeAssigneeEmbed(staffRaw) : null,
  };
}

export type ConversationQueryOptions = {
  db?: TypedSupabaseClient;
  /** Default 100, max 500. */
  limit?: number;
};

async function listWithContext(
  supabase: TypedSupabaseClient,
  args: {
    dealershipId: string;
    limit: number;
    filter: "open" | "mine" | "unassigned";
    staffUserId?: string;
  }
): Promise<Result<ConversationListEntry[]>> {
  const openStatuses = [...OPEN_QUEUE_STATUSES];

  let q = supabase
    .from("conversations")
    .select(CONVERSATION_LIST_SELECT)
    .eq("dealership_id", args.dealershipId)
    .in("status", openStatuses);

  if (args.filter === "mine") {
    const sid = args.staffUserId?.trim();
    if (!sid) {
      return err("VALIDATION", "staffUserId is required for listMyConversations");
    }
    q = q.eq("assigned_to_user_id", sid);
  } else if (args.filter === "unassigned") {
    q = q.is("assigned_to_user_id", null);
  }

  const res = await q
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(args.limit);

  if (res.error) {
    return fromPostgrestError(res.error);
  }

  const rows = (res.data ?? []) as unknown as Array<
    Record<string, unknown> & {
      customers?: unknown;
      staff_users?: unknown;
    }
  >;

  return ok(rows.map((r) => mapListRow(r)));
}

/**
 * Open queue (`open` | `pending` | `waiting_for_human`) for a dealership, newest activity first.
 * Uses composite filters aligned with `conversations_dealership_status_last_msg_idx`.
 */
export async function listOpenConversations(
  dealershipId: string,
  options?: ConversationQueryOptions
): Promise<Result<ConversationListEntry[]>> {
  const id = dealershipId?.trim();
  if (!id) {
    return err("VALIDATION", "dealershipId is required");
  }

  const supabase = await resolveDb(options?.db);
  const limit = Math.min(options?.limit ?? LIST_LIMIT_DEFAULT, LIST_LIMIT_MAX);

  return listWithContext(supabase, {
    dealershipId: id,
    limit,
    filter: "open",
  });
}

/**
 * Same open-queue statuses as {@link listOpenConversations}, scoped to threads assigned to
 * `staffUserId`. Matches partial index patterns on `(dealership_id, assigned_to_user_id, …)`.
 */
export async function listMyConversations(
  dealershipId: string,
  staffUserId: string,
  options?: ConversationQueryOptions
): Promise<Result<ConversationListEntry[]>> {
  const d = dealershipId?.trim();
  const s = staffUserId?.trim();
  if (!d || !s) {
    return err("VALIDATION", "dealershipId and staffUserId are required");
  }

  const supabase = await resolveDb(options?.db);
  const limit = Math.min(options?.limit ?? LIST_LIMIT_DEFAULT, LIST_LIMIT_MAX);

  return listWithContext(supabase, {
    dealershipId: d,
    limit,
    filter: "mine",
    staffUserId: s,
  });
}

/**
 * Open-queue threads with no assignee (dealership-scoped). Uses unassigned inbox index patterns.
 */
export async function listUnassignedConversations(
  dealershipId: string,
  options?: ConversationQueryOptions
): Promise<Result<ConversationListEntry[]>> {
  const id = dealershipId?.trim();
  if (!id) {
    return err("VALIDATION", "dealershipId is required");
  }

  const supabase = await resolveDb(options?.db);
  const limit = Math.min(options?.limit ?? LIST_LIMIT_DEFAULT, LIST_LIMIT_MAX);

  return listWithContext(supabase, {
    dealershipId: id,
    limit,
    filter: "unassigned",
  });
}

/**
 * Single conversation with customer + assignee embeds. Tenant-safe: requires `dealershipId`.
 */
export async function getConversationById(
  dealershipId: string,
  conversationId: string,
  options?: ConversationQueryOptions
): Promise<Result<ConversationDetail>> {
  const d = dealershipId?.trim();
  const c = conversationId?.trim();
  if (!d || !c) {
    return err("VALIDATION", "dealershipId and conversationId are required");
  }

  const supabase = await resolveDb(options?.db);

  const res = await supabase
    .from("conversations")
    .select(CONVERSATION_LIST_SELECT)
    .eq("dealership_id", d)
    .eq("id", c)
    .maybeSingle();

  if (res.error) {
    return fromPostgrestError(res.error);
  }

  if (!res.data) {
    return err("NOT_FOUND", "Conversation not found");
  }

  const row = res.data as unknown as Record<string, unknown> & {
    customers?: unknown;
    staff_users?: unknown;
  };

  return ok(mapListRow(row));
}

/**
 * Full inbox list for any tab: open-queue filters, department tabs, closed — with
 * `customers` + `staff_users!conversations_assigned_to_user_id_fkey` embeds (indexed selects).
 */
export async function listInboxConversationEntries(
  dealershipId: string,
  filter: InboxFilter,
  currentStaffUserId: string,
  canViewDealershipWide: boolean,
  options?: ConversationQueryOptions & {
    /** Narrow all_open / sales / service to this assignee (same dealership via RLS). */
    assigneeScopeUserId?: string | null;
  }
): Promise<Result<ConversationListEntry[]>> {
  const d = dealershipId?.trim();
  if (!d) {
    return err("VALIDATION", "dealershipId is required");
  }

  const supabase = await resolveDb(options?.db);
  const limit = Math.min(options?.limit ?? LIST_LIMIT_DEFAULT, LIST_LIMIT_MAX);

  let q = supabase
    .from("conversations")
    .select(CONVERSATION_LIST_SELECT)
    .eq("dealership_id", d);

  const effectiveFilter =
    canViewDealershipWide || filter === "mine" || filter === "unassigned"
      ? filter
      : "mine";

  switch (effectiveFilter) {
    case "all_open":
      q = q.in("status", [...OPEN_QUEUE_STATUSES]);
      break;
    case "mine":
      q = q
        .in("status", [...OPEN_QUEUE_STATUSES])
        .eq("assigned_to_user_id", currentStaffUserId.trim());
      break;
    case "unassigned":
      q = q.in("status", [...OPEN_QUEUE_STATUSES]).is("assigned_to_user_id", null);
      break;
    case "sales":
      q = q
        .eq("department", "sales" as StaffDepartment)
        .in("status", [...OPEN_QUEUE_STATUSES]);
      break;
    case "service":
      q = q
        .eq("department", "service" as StaffDepartment)
        .in("status", [...OPEN_QUEUE_STATUSES]);
      break;
    case "closed":
      q = q.in("status", [...COMPLETED_CONVERSATION_STATUSES]);
      break;
    default:
      q = q.in("status", [...OPEN_QUEUE_STATUSES]);
  }

  const scope = options?.assigneeScopeUserId?.trim();
  if (
    scope &&
    (effectiveFilter === "all_open" ||
      effectiveFilter === "sales" ||
      effectiveFilter === "service")
  ) {
    q = q.eq("assigned_to_user_id", scope);
  }

  const res = await q
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (res.error) {
    return fromPostgrestError(res.error);
  }

  const rows = (res.data ?? []) as unknown as Array<
    Record<string, unknown> & {
      customers?: unknown;
      staff_users?: unknown;
    }
  >;

  return ok(rows.map((r) => mapListRow(r)));
}
