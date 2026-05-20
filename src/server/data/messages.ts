import type { Json, Tables, TablesInsert } from "@/integrations/supabase/database.types";
import { insertConversationEvent } from "@/server/data/conversation-events";
import { getConversationRowById } from "@/server/data/conversations";
import { resolveDb } from "@/server/data/internal";
import { fromPostgrestError } from "@/server/data/postgrest-error";
import { getStaffUserById } from "@/server/data/staff-users";
import type { TypedSupabaseClient } from "@/server/db/server-client";
import { err, ok, type Result } from "@/server/result";

/**
 * Message rows — use these helpers for reads/writes; UI should call server actions / loaders
 * that delegate here. Realtime can mirror `messages` inserts/updates against the same shapes.
 */
export type MessageRow = Tables<"messages">;

/** Matches inbox thread labels for staff senders when `staff_users` is missing. */
const STAFF_SENDER_DISPLAY_FALLBACK = "Staff";

type MessageInsert = TablesInsert<"messages">;

/**
 * Message row for the chat UI: core columns plus resolved staff display name when applicable.
 * Ordered by `created_at` then `id` (stable timeline when timestamps collide).
 */
export type ConversationMessageForChatUi = {
  id: MessageRow["id"];
  conversation_id: MessageRow["conversation_id"];
  sender_type: MessageRow["sender_type"];
  sender_user_id: MessageRow["sender_user_id"];
  body: MessageRow["body"];
  delivery_status: MessageRow["delivery_status"];
  metadata: MessageRow["metadata"];
  twilio_outbound_sid: MessageRow["twilio_outbound_sid"];
  created_at: MessageRow["created_at"];
  updated_at: MessageRow["updated_at"];
  /**
   * When `sender_type` is `staff`: `staff_users.display_name` if present, else {@link STAFF_SENDER_DISPLAY_FALLBACK}.
   * When `sender_type` is not `staff`: always `null` (customer/system/ai labels come from conversation or fixed copy).
   */
  staff_display_name: string | null;
};

type MessageRowWithStaffJoin = Pick<
  MessageRow,
  | "id"
  | "conversation_id"
  | "sender_type"
  | "sender_user_id"
  | "body"
  | "delivery_status"
  | "metadata"
  | "twilio_outbound_sid"
  | "created_at"
  | "updated_at"
> & {
  staff_users: { display_name: string | null } | { display_name: string | null }[] | null;
};

function normalizeStaffEmbed(
  embed: MessageRowWithStaffJoin["staff_users"]
): { display_name: string | null } | null {
  if (embed == null) {
    return null;
  }
  const row = Array.isArray(embed) ? embed[0] : embed;
  return row ?? null;
}

function mapRowToConversationMessageForChatUi(
  row: MessageRowWithStaffJoin
): ConversationMessageForChatUi {
  const staffEmbed = normalizeStaffEmbed(row.staff_users);
  const nameFromProfile = staffEmbed?.display_name?.trim() || null;

  let staff_display_name: string | null = null;
  if (row.sender_type === "staff") {
    staff_display_name = nameFromProfile ?? STAFF_SENDER_DISPLAY_FALLBACK;
  }

  return {
    id: row.id,
    conversation_id: row.conversation_id,
    sender_type: row.sender_type,
    sender_user_id: row.sender_user_id,
    body: row.body,
    delivery_status: row.delivery_status,
    metadata: row.metadata,
    twilio_outbound_sid: row.twilio_outbound_sid,
    created_at: row.created_at,
    updated_at: row.updated_at,
    staff_display_name,
  };
}

export type CreateMessageInput = {
  dealershipId: string;
  conversationId: string;
  senderType: MessageInsert["sender_type"];
  /** Required when `senderType` is `staff` (must belong to `dealershipId`). Ignored for `customer`; cleared for `system` / `ai`. */
  senderUserId?: MessageInsert["sender_user_id"];
  body: string;
  rawPayload?: MessageInsert["raw_payload"];
  deliveryStatus?: MessageInsert["delivery_status"];
  metadata?: MessageInsert["metadata"];
  twilioInboundSid?: MessageInsert["twilio_inbound_sid"];
  twilioOutboundSid?: MessageInsert["twilio_outbound_sid"];
  /** Merged into the default `message_inbound` event payload (customer messages only). */
  inboundEventExtras?: Record<string, unknown>;
  /** Merged into the default `human_reply_sent` event payload (staff messages only). */
  staffReplyEventExtras?: Record<string, unknown>;
};

/**
 * Chronological thread history (oldest → newest), dealership-scoped via parent conversation.
 * Joins `staff_users` for staff `display_name` with a stable fallback when the profile row is missing.
 */
export async function getMessagesForConversation(
  dealershipId: string,
  conversationId: string,
  options?: { limit?: number; db?: TypedSupabaseClient }
): Promise<Result<ConversationMessageForChatUi[]>> {
  const supabase = await resolveDb(options?.db);
  const limit = Math.min(options?.limit ?? 200, 1000);

  const access = await getConversationRowById(dealershipId, conversationId, supabase);
  if (!access.ok) {
    return access;
  }

  const cid = conversationId.trim();
  const res = await supabase
    .from("messages")
    .select(
      `
      id,
      conversation_id,
      sender_type,
      sender_user_id,
      body,
      delivery_status,
      metadata,
      twilio_outbound_sid,
      created_at,
      updated_at,
      staff_users!messages_sender_user_id_fkey (
        display_name
      )
    `
    )
    .eq("conversation_id", cid)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true })
    .limit(limit);

  if (res.error) {
    return fromPostgrestError(res.error);
  }

  const rows = (res.data ?? []) as MessageRowWithStaffJoin[];
  return ok(rows.map(mapRowToConversationMessageForChatUi));
}

/**
 * Fetch one message scoped to a conversation + dealership.
 * Use this for server actions that operate on an existing thread message (retry, audit, etc.).
 */
export async function getMessageByIdForConversation(
  dealershipId: string,
  conversationId: string,
  messageId: string,
  db?: TypedSupabaseClient
): Promise<Result<MessageRow>> {
  const supabase = await resolveDb(db);
  const access = await getConversationRowById(dealershipId, conversationId, supabase);
  if (!access.ok) {
    return access;
  }

  const res = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId.trim())
    .eq("id", messageId.trim())
    .maybeSingle();

  if (res.error) {
    return fromPostgrestError(res.error);
  }
  if (!res.data) {
    return err("NOT_FOUND", "Message not found in this conversation.");
  }
  return ok(res.data);
}

/** @deprecated Prefer {@link getMessagesForConversation} */
export const getConversationMessages = getMessagesForConversation;

function mergeEventPayload(
  base: Record<string, unknown>,
  extras?: Record<string, unknown>
): Json {
  if (!extras) {
    return base as Json;
  }
  return { ...base, ...extras } as Json;
}

function validateMessageBody(body: string | undefined): Result<string> {
  const trimmed = (body ?? "").trim();
  if (!trimmed) {
    return err("VALIDATION", "Message body cannot be empty");
  }
  return ok(trimmed);
}

/**
 * Inserts a message and (for customer/staff) a matching audit row. `conversations.last_message_at`
 * is updated by the DB trigger `messages_bump_conversation_last_message_at`.
 *
 * - **Customer** → `message_inbound` (actor null).
 * - **Staff** → `human_reply_sent` (actor = sender); staff must exist under `dealershipId` and be active.
 * - **AI** → `ai_reply_sent` (actor null).
 * - **System** → no conversation_event (use dedicated flows if an audit row is required).
 *
 * If the event insert fails after the message insert succeeds, the message row is deleted so we
 * never persist a customer/staff message without its audit event.
 */
export async function createMessage(
  input: CreateMessageInput,
  db?: TypedSupabaseClient
): Promise<Result<MessageRow>> {
  if (!input.dealershipId?.trim() || !input.conversationId?.trim()) {
    return err("VALIDATION", "dealershipId and conversationId are required");
  }

  const bodyRes = validateMessageBody(input.body);
  if (!bodyRes.ok) {
    return bodyRes;
  }
  const body = bodyRes.data;

  const supabase = await resolveDb(db);
  const dealershipId = input.dealershipId.trim();
  const conversationId = input.conversationId.trim();

  const access = await getConversationRowById(dealershipId, conversationId, supabase);
  if (!access.ok) {
    return access;
  }
  const conv = access.data;

  let sender_user_id: MessageInsert["sender_user_id"] = null;

  if (input.senderType === "customer") {
    if (input.senderUserId != null && String(input.senderUserId).trim() !== "") {
      return err("VALIDATION", "sender_user_id must not be set for customer messages");
    }
  } else if (input.senderType === "staff") {
    const sid = input.senderUserId?.trim();
    if (!sid) {
      return err("VALIDATION", "sender_user_id is required for staff messages");
    }
    const staffRes = await getStaffUserById(dealershipId, sid, supabase);
    if (!staffRes.ok) {
      return staffRes;
    }
    if (!staffRes.data.is_active) {
      return err("FORBIDDEN", "Inactive staff cannot send messages");
    }
    sender_user_id = sid;
  } else if (input.senderType === "system" || input.senderType === "ai") {
    if (input.senderUserId != null && String(input.senderUserId).trim() !== "") {
      return err("VALIDATION", "sender_user_id must not be set for system or AI messages");
    }
  } else {
    return err("VALIDATION", "Unsupported sender_type");
  }

  const row: TablesInsert<"messages"> = {
    conversation_id: conversationId,
    sender_type: input.senderType,
    sender_user_id,
    body,
    raw_payload: input.rawPayload ?? {},
    delivery_status: input.deliveryStatus ?? "pending",
    metadata: input.metadata ?? {},
    twilio_inbound_sid: input.twilioInboundSid ?? null,
    twilio_outbound_sid: input.twilioOutboundSid ?? null,
  };

  const inserted = await supabase.from("messages").insert(row).select().single();

  if (inserted.error || !inserted.data) {
    return fromPostgrestError(inserted.error);
  }

  const message = inserted.data;

  if (input.senderType === "customer") {
    const payload = mergeEventPayload(
      {
        message_id: message.id,
        channel: conv.channel,
      },
      input.inboundEventExtras
    );
    const ev = await insertConversationEvent(supabase, {
      conversation_id: conversationId,
      event_type: "message_inbound",
      actor_user_id: null,
      payload,
    });
    if (!ev.ok) {
      await supabase.from("messages").delete().eq("id", message.id);
      return ev;
    }
  } else if (input.senderType === "staff") {
    const payload = mergeEventPayload(
      {
        message_id: message.id,
        body_preview: body.slice(0, 200),
        channel: conv.channel,
      },
      input.staffReplyEventExtras
    );
    const ev = await insertConversationEvent(supabase, {
      conversation_id: conversationId,
      event_type: "human_reply_sent",
      actor_user_id: sender_user_id,
      payload,
    });
    if (!ev.ok) {
      await supabase.from("messages").delete().eq("id", message.id);
      return ev;
    }
  } else if (input.senderType === "ai") {
    const payload = mergeEventPayload({
      message_id: message.id,
      body_preview: body.slice(0, 200),
      channel: conv.channel,
    });
    const ev = await insertConversationEvent(supabase, {
      conversation_id: conversationId,
      event_type: "ai_reply_sent",
      actor_user_id: null,
      payload,
    });
    if (!ev.ok) {
      await supabase.from("messages").delete().eq("id", message.id);
      return ev;
    }
  }

  return ok(message);
}
