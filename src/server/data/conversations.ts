/**
 * Raw conversation rows and mutations. For inbox list/detail with customer + assignee embeds,
 * use `@/server/data/conversation-queries` (`listOpenConversations`, `getConversationById`, …).
 */
import type {
  ConversationChannel,
  ConversationStatus,
  Database,
  Json,
  StaffDepartment,
  Tables,
} from "@/integrations/supabase/database.types";
import {
  defaultAiLeadControl,
  mergeConversationControl,
} from "@/lib/conversation/control-metadata";
import { OPEN_QUEUE_STATUSES } from "@/lib/conversation/status-sets";
import { resolveDb } from "@/server/data/internal";
import {
  fromPostgrestError,
  resultFromNullable,
} from "@/server/data/postgrest-error";
import type { TypedSupabaseClient } from "@/server/db/server-client";
import type { PostgrestError } from "@supabase/supabase-js";
import { err, ok, type Err, type Result } from "@/server/result";

/**
 * Conversation rows — canonical shape for server access and future Realtime payloads
 * (subscribe to `conversations` / `messages`; these functions stay the read/write contract).
 */
export type ConversationRow = Tables<"conversations">;

export type CreateConversationInput = {
  dealershipId: string;
  customerId?: string | null;
  assignedToUserId?: string | null;
  channel: Database["public"]["Tables"]["conversations"]["Insert"]["channel"];
  department?: Database["public"]["Tables"]["conversations"]["Insert"]["department"];
  title?: string | null;
  priority?: Database["public"]["Tables"]["conversations"]["Insert"]["priority"];
  /** When true, allows inbound AI triage + widget auto-replies per policy. Omit to use DB default (false). */
  aiEnabled?: boolean;
  metadata?: Database["public"]["Tables"]["conversations"]["Insert"]["metadata"];
  /** Overrides default AI control patch (e.g. widget autopilot). */
  controlPatch?: Record<string, unknown>;
};

/** Typed filter for listing conversations (dealership-scoped). */
export type ConversationListFilter = {
  dealershipId: string;
  /**
   * Status filter. Omit or leave empty to default to the open queue
   * (`OPEN_QUEUE_STATUSES`). Use `"all"` only with a strict `limit` (full scans are expensive).
   */
  statuses?: ConversationStatus[] | "all";
  department?: StaffDepartment;
  /** Narrow to one assignee, unassigned only, or any (omit). */
  assignee?:
    | { kind: "unassigned" }
    | { kind: "staff"; staffUserId: string };
  channel?: ConversationChannel;
  customerId?: string | null;
  limit?: number;
};

/**
 * Filtered conversation list (newest activity first). Prefer this over ad-hoc queries;
 * inbox UI can compose richer views on top via `@/server/data/inbox`.
 */
export async function listConversationsByFilter(
  filter: ConversationListFilter,
  options?: { db?: TypedSupabaseClient }
): Promise<Result<ConversationRow[]>> {
  const dealershipId = filter.dealershipId?.trim();
  if (!dealershipId) {
    return err("VALIDATION", "dealershipId is required");
  }

  const supabase = await resolveDb(options?.db);
  const limit = Math.min(filter.limit ?? 100, 500);

  let q = supabase
    .from("conversations")
    .select("*")
    .eq("dealership_id", dealershipId);

  let statuses: ConversationStatus[] | null;
  if (filter.statuses === "all") {
    statuses = null;
  } else if (filter.statuses?.length) {
    statuses = filter.statuses;
  } else {
    statuses = [...OPEN_QUEUE_STATUSES];
  }

  if (statuses) {
    q = q.in("status", statuses);
  }

  if (filter.department) {
    q = q.eq("department", filter.department);
  }

  if (filter.assignee) {
    if (filter.assignee.kind === "unassigned") {
      q = q.is("assigned_to_user_id", null);
    } else {
      const sid = filter.assignee.staffUserId?.trim();
      if (!sid) {
        return err("VALIDATION", "assignee.staffUserId is required");
      }
      q = q.eq("assigned_to_user_id", sid);
    }
  }

  if (filter.channel) {
    q = q.eq("channel", filter.channel);
  }

  const customerId = filter.customerId?.trim();
  if (customerId) {
    q = q.eq("customer_id", customerId);
  }

  const res = await q
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (res.error) {
    return fromPostgrestError(res.error);
  }

  return ok(res.data ?? []);
}

export async function getConversationRowById(
  dealershipId: string,
  conversationId: string,
  db?: TypedSupabaseClient
): Promise<Result<ConversationRow>> {
  const d = dealershipId?.trim();
  const c = conversationId?.trim();
  if (!d || !c) {
    return err("VALIDATION", "dealershipId and conversationId are required");
  }

  const supabase = await resolveDb(db);
  const res = await supabase
    .from("conversations")
    .select("*")
    .eq("dealership_id", d)
    .eq("id", c)
    .maybeSingle();

  if (res.error) {
    return fromPostgrestError(res.error);
  }

  return resultFromNullable(res.data, "Conversation not found");
}

export async function createConversation(
  input: CreateConversationInput,
  db?: TypedSupabaseClient
): Promise<Result<ConversationRow>> {
  if (!input.dealershipId?.trim()) {
    return err("VALIDATION", "dealershipId is required");
  }

  const supabase = await resolveDb(db);

  const row: Database["public"]["Tables"]["conversations"]["Insert"] = {
    dealership_id: input.dealershipId,
    customer_id: input.customerId ?? null,
    assigned_to_user_id: input.assignedToUserId ?? null,
    channel: input.channel,
    department: input.department ?? "general",
    title: input.title ?? null,
    priority: input.priority ?? "normal",
    ...(input.aiEnabled === undefined ? {} : { ai_enabled: input.aiEnabled }),
    metadata: mergeConversationControl(
      (input.metadata ?? {}) as Json,
      input.controlPatch ?? defaultAiLeadControl()
    ),
  };

  const res = await supabase.from("conversations").insert(row).select().single();

  if (res.error) {
    return fromPostgrestError(res.error);
  }

  return ok(res.data);
}

/**
 * Most recent conversation (any status) for a customer on a channel.
 * Used for sticky owner routing when no active thread exists.
 */
export async function findMostRecentConversationForCustomerOnChannel(
  dealershipId: string,
  customerId: string,
  channel: ConversationChannel,
  db?: TypedSupabaseClient
): Promise<Result<ConversationRow | null>> {
  const supabase = await resolveDb(db);

  const res = await supabase
    .from("conversations")
    .select("*")
    .eq("dealership_id", dealershipId)
    .eq("customer_id", customerId)
    .eq("channel", channel)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .order("updated_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (res.error) {
    return fromPostgrestError(res.error);
  }

  return ok(res.data);
}

/**
 * Newest active thread for a customer on a given DB channel (open / pending / waiting_for_human), if any.
 */
export async function findActiveChannelConversationForCustomer(
  dealershipId: string,
  customerId: string,
  channel: ConversationChannel,
  db?: TypedSupabaseClient
): Promise<Result<ConversationRow | null>> {
  const supabase = await resolveDb(db);

  const res = await supabase
    .from("conversations")
    .select("*")
    .eq("dealership_id", dealershipId)
    .eq("customer_id", customerId)
    .eq("channel", channel)
    .in("status", [...OPEN_QUEUE_STATUSES])
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (res.error) {
    return fromPostgrestError(res.error);
  }

  return ok(res.data);
}

/**
 * Newest active SMS thread for a customer (open / pending / waiting_for_human), if any.
 */
export async function findActiveSmsConversationForCustomer(
  dealershipId: string,
  customerId: string,
  db?: TypedSupabaseClient
): Promise<Result<ConversationRow | null>> {
  return findActiveChannelConversationForCustomer(dealershipId, customerId, "sms", db);
}

/**
 * Sets conversation status with `set_conversation_status` (row lock + `status_changed` event in one transaction).
 * Supports **pending** and **closed** only (inbox workflow).
 */
export async function updateConversationStatus(
  dealershipId: string,
  conversationId: string,
  nextStatus: ConversationStatus,
  actorUserId: string | null,
  options?: { db?: TypedSupabaseClient; reason?: string }
): Promise<Result<ConversationRow>> {
  if (nextStatus !== "pending" && nextStatus !== "closed") {
    return err("VALIDATION", "Unsupported status for this operation.");
  }

  const actor = actorUserId?.trim();
  if (!actor) {
    return err("VALIDATION", "Actor is required.");
  }

  const supabase = await resolveDb(options?.db);

  const rpc = await supabase.rpc("set_conversation_status", {
    p_dealership_id: dealershipId.trim(),
    p_conversation_id: conversationId.trim(),
    p_next_status: nextStatus,
    p_actor_user_id: actor,
    p_reason: options?.reason ?? null,
  });

  if (rpc.error) {
    return fromSetConversationStatusRpcError(rpc.error);
  }

  const row = rpc.data as ConversationRow | null;
  if (!row) {
    return err("DATABASE_ERROR", "set_conversation_status returned no row");
  }

  return ok(row);
}

/**
 * Updates inbox department routing bucket (sales/service/general/parts/bdc/management).
 * Used by manual triage controls in the inbox thread UI.
 */
export async function updateConversationDepartment(
  dealershipId: string,
  conversationId: string,
  nextDepartment: StaffDepartment,
  options?: { db?: TypedSupabaseClient }
): Promise<Result<ConversationRow>> {
  const d = dealershipId?.trim();
  const c = conversationId?.trim();
  if (!d || !c) {
    return err("VALIDATION", "dealershipId and conversationId are required.");
  }

  const supabase = await resolveDb(options?.db);
  const res = await supabase
    .from("conversations")
    .update({ department: nextDepartment })
    .eq("dealership_id", d)
    .eq("id", c)
    .select("*")
    .single();

  if (res.error) {
    return fromPostgrestError(res.error);
  }

  return ok(res.data);
}

function fromSetConversationStatusRpcError(error: PostgrestError): Err {
  const hint = `${error.message ?? ""} ${error.hint ?? ""} ${error.details ?? ""}`;
  if (
    hint.includes("set_conversation_status") &&
    (hint.includes("Could not find the function") ||
      hint.includes("schema cache"))
  ) {
    return err(
      "DATABASE_ERROR",
      "This database is missing the set_conversation_status RPC. Apply Supabase migrations through 20260426120000_claim_and_status_rpcs.sql (e.g. supabase db push or run migrations in the SQL Editor), then retry."
    );
  }
  if (hint.includes("ALREADY_PENDING")) {
    return err("VALIDATION", "Already marked as pending.");
  }
  if (hint.includes("ALREADY_CLOSED")) {
    return err("VALIDATION", "Already closed.");
  }
  if (hint.includes("CONVERSATION_TERMINAL")) {
    return err("FORBIDDEN", "Status cannot be changed.");
  }
  if (hint.includes("CONVERSATION_NOT_FOUND")) {
    return err("NOT_FOUND", "Conversation not found");
  }
  if (hint.includes("INVALID_ACTOR")) {
    return err("NOT_FOUND", "Actor was not found or is inactive.");
  }
  if (hint.includes("FORBIDDEN")) {
    return err("FORBIDDEN", "You do not have permission to update this conversation.");
  }
  return fromPostgrestError(error);
}

/** @deprecated Prefer {@link updateConversationStatus} — kept for existing imports. */
export const markConversationStatus = updateConversationStatus;
