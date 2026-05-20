import "server-only";

import type { Json } from "@/integrations/supabase/database.types";
import type { TypedSupabaseClient } from "@/server/db/server-client";
import {
  createConversation,
  findActiveChannelConversationForCustomer,
  findMostRecentConversationForCustomerOnChannel,
  getConversationRowById,
  type ConversationRow,
} from "@/server/data/conversations";
import { insertConversationEvent } from "@/server/data/conversation-events";
import {
  createAnonymousWebCustomer,
  getCustomerById,
  getOrCreateCustomerByPhoneOrEmail,
  type CustomerRow,
} from "@/server/data/customers";
import { createMessage, type MessageRow } from "@/server/data/messages";
import { resolveDb } from "@/server/data/internal";
import { err, ok, type Result } from "@/server/result";

import {
  toDbConversationChannel,
  type NormalizedInboundMessage,
} from "./normalized-inbound-message";
import {
  isWithinStickyOwnerWindow,
  STICKY_OWNER_WINDOW_HOURS,
} from "./sticky-owner";
import { runPostInboundMessageHooks } from "./post-inbound-hooks";

export type ApplyInboundMessageOutcome =
  | {
      duplicate: true;
      conversation: ConversationRow;
      message: MessageRow;
    }
  | {
      duplicate: false;
      conversation: ConversationRow;
      message: MessageRow;
      createdNewConversation: boolean;
    };

function asJsonRecord(value: unknown): Json {
  return JSON.parse(JSON.stringify(value ?? null)) as Json;
}

function buildStoredRawPayload(normalized: NormalizedInboundMessage): Json {
  return {
    received_at: new Date().toISOString(),
    normalized: asJsonRecord(normalized),
  } as Json;
}

async function resolveCustomerForInbound(
  normalized: NormalizedInboundMessage,
  supabase: TypedSupabaseClient
): Promise<Result<CustomerRow>> {
  const dealershipId = normalized.dealershipId;
  const phone = normalized.customerPhone?.trim();
  const handle = normalized.customerHandle?.trim();
  const display = normalized.customerDisplayName?.trim() || null;

  if (phone) {
    return getOrCreateCustomerByPhoneOrEmail(
      { dealershipId, phoneE164: phone, displayName: display },
      supabase
    );
  }

  if (handle?.includes("@")) {
    return getOrCreateCustomerByPhoneOrEmail(
      { dealershipId, email: handle, displayName: display },
      supabase
    );
  }

  if (handle) {
    return createAnonymousWebCustomer(dealershipId, {
      displayName: display ?? handle.slice(0, 64),
      metadata: {
        inbound_handle: handle,
        inbound_channel: normalized.channel,
      },
      db: supabase,
    });
  }

  if (display) {
    return createAnonymousWebCustomer(dealershipId, {
      displayName: display,
      metadata: { inbound_channel: normalized.channel },
      db: supabase,
    });
  }

  return err("VALIDATION", "Customer identity required (phone, handle, or display name).");
}

async function resolveStickyOwnerForNewConversation(
  supabase: TypedSupabaseClient,
  args: {
    dealershipId: string;
    customerId: string;
    channel: import("@/integrations/supabase/database.types").ConversationChannel;
  }
): Promise<string | null> {
  const recent = await findMostRecentConversationForCustomerOnChannel(
    args.dealershipId,
    args.customerId,
    args.channel,
    supabase
  );
  if (!recent.ok || !recent.data?.assigned_to_user_id) {
    return null;
  }
  if (!isWithinStickyOwnerWindow(recent.data)) {
    return null;
  }

  const ownerId = recent.data.assigned_to_user_id;
  const ownerCheck = await supabase
    .from("staff_users")
    .select("id")
    .eq("dealership_id", args.dealershipId)
    .eq("id", ownerId)
    .eq("is_active", true)
    .maybeSingle();

  if (ownerCheck.error || !ownerCheck.data?.id) {
    return null;
  }
  return ownerCheck.data.id;
}

function conversationTitleForInbound(
  normalized: NormalizedInboundMessage,
  customer: CustomerRow
): string {
  const name = customer.display_name?.trim() || "Customer";
  switch (normalized.channel) {
    case "sms":
      return normalized.customerPhone?.trim()
        ? `SMS — ${normalized.customerPhone.trim()}`
        : `SMS — ${name}`;
    case "web_chat":
      return `Web — ${name}`;
    case "messenger":
      return `Messenger — ${name}`;
    case "instagram":
      return `Instagram — ${name}`;
    case "whatsapp":
      return `WhatsApp — ${name}`;
  }
}

async function findDuplicateByTwilioInboundSid(
  supabase: TypedSupabaseClient,
  dealershipId: string,
  sid: string
): Promise<Result<MessageRow | null>> {
  const bySid = await supabase
    .from("messages")
    .select("*")
    .eq("twilio_inbound_sid", sid)
    .maybeSingle();

  if (bySid.error) {
    return err("DATABASE_ERROR", bySid.error.message);
  }
  if (!bySid.data) {
    return ok(null);
  }

  const conv = await getConversationRowById(dealershipId, bySid.data.conversation_id, supabase);
  if (!conv.ok) {
    return ok(null);
  }

  return ok(bySid.data as MessageRow);
}

async function findDuplicateByExternalInConversation(
  supabase: TypedSupabaseClient,
  conversationId: string,
  externalMessageId: string
): Promise<Result<MessageRow | null>> {
  const byExternal = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .filter("metadata->>external_message_id", "eq", externalMessageId)
    .maybeSingle();

  if (byExternal.error) {
    return err("DATABASE_ERROR", byExternal.error.message);
  }

  return ok(byExternal.data as MessageRow | null);
}

/**
 * Single server entry for inbound customer text: resolve customer + active conversation (or use
 * `targetConversationId`), dedupe, insert `messages` (which emits `message_inbound` and bumps
 * `last_message_at` via DB trigger), then run post-ingest hooks.
 */
export async function applyInboundMessage(
  normalized: NormalizedInboundMessage,
  db?: TypedSupabaseClient
): Promise<Result<ApplyInboundMessageOutcome>> {
  const dealershipId = normalized.dealershipId?.trim();
  if (!dealershipId) {
    return err("VALIDATION", "dealershipId is required.");
  }

  const text = normalized.text.trim();
  if (!text) {
    return err("VALIDATION", "Inbound message text cannot be empty.");
  }

  const externalMessageId = normalized.externalMessageId?.trim();
  if (!externalMessageId) {
    return err("VALIDATION", "externalMessageId is required.");
  }

  const supabase = await resolveDb(db);
  const dbChannel = toDbConversationChannel(normalized.channel);
  const twilioSid = normalized.twilioInboundSid?.trim() || null;

  if (twilioSid) {
    const dupEarly = await findDuplicateByTwilioInboundSid(supabase, dealershipId, twilioSid);
    if (!dupEarly.ok) {
      return dupEarly;
    }
    if (dupEarly.data) {
      const conv = await getConversationRowById(
        dealershipId,
        dupEarly.data.conversation_id,
        supabase
      );
      if (!conv.ok) {
        return conv;
      }
      return ok({
        duplicate: true,
        conversation: conv.data,
        message: dupEarly.data,
      });
    }
  }

  let customer: CustomerRow;
  let conversation: ConversationRow;
  let createdNewConversation = false;

  const targetId = normalized.targetConversationId?.trim();

  if (targetId) {
    const convRes = await getConversationRowById(dealershipId, targetId, supabase);
    if (!convRes.ok) {
      return convRes;
    }
    conversation = convRes.data;
    if (conversation.channel !== dbChannel) {
      return err("VALIDATION", "Conversation channel does not match inbound channel.");
    }
    const cid = conversation.customer_id?.trim();
    if (!cid) {
      return err("VALIDATION", "Conversation has no linked customer.");
    }
    const custRes = await getCustomerById(dealershipId, cid, supabase);
    if (!custRes.ok) {
      return custRes;
    }
    customer = custRes.data;
  } else {
    const custRes = await resolveCustomerForInbound(normalized, supabase);
    if (!custRes.ok) {
      return custRes;
    }
    customer = custRes.data;

    const active = await findActiveChannelConversationForCustomer(
      dealershipId,
      customer.id,
      dbChannel,
      supabase
    );
    if (!active.ok) {
      return active;
    }

    if (active.data) {
      conversation = active.data;
    } else {
      const stickyOwnerId = await resolveStickyOwnerForNewConversation(supabase, {
        dealershipId,
        customerId: customer.id,
        channel: dbChannel,
      });
      const created = await createConversation(
        {
          dealershipId,
          customerId: customer.id,
          assignedToUserId: stickyOwnerId,
          channel: dbChannel,
          department: normalized.routeDepartment ?? "general",
          title: conversationTitleForInbound(normalized, customer),
          metadata: {
            inbound: {
              product_channel: normalized.channel,
              channel_account_id: normalized.channelAccountId ?? null,
              routed_department: normalized.routeDepartment ?? null,
              sticky_owner_applied: Boolean(stickyOwnerId),
              sticky_owner_window_hours: STICKY_OWNER_WINDOW_HOURS,
            },
          },
        },
        supabase
      );
      if (!created.ok) {
        return created;
      }
      conversation = created.data;
      createdNewConversation = true;

      const createdEv = await insertConversationEvent(supabase, {
        conversation_id: conversation.id,
        event_type: "conversation_created",
        actor_user_id: null,
        payload: {
          source: `inbound_${normalized.channel}`,
          channel: dbChannel,
          kind: "inbound_conversation_started",
        },
      });
      if (!createdEv.ok) {
        return createdEv;
      }
    }
  }

  const dupExternal = await findDuplicateByExternalInConversation(
    supabase,
    conversation.id,
    externalMessageId
  );
  if (!dupExternal.ok) {
    return dupExternal;
  }
  if (dupExternal.data) {
    const conv = await getConversationRowById(dealershipId, dupExternal.data.conversation_id, supabase);
    if (!conv.ok) {
      return conv;
    }
    return ok({
      duplicate: true,
      conversation: conv.data,
      message: dupExternal.data,
    });
  }

  const metadata: Record<string, unknown> = {
    inbound_product_channel: normalized.channel,
    external_message_id: externalMessageId,
    inbound_timestamp: normalized.timestamp,
  };
  if (normalized.channelAccountId) {
    metadata.channel_account_id = normalized.channelAccountId;
  }
  if (normalized.customerDisplayName) {
    metadata.customer_display_name = normalized.customerDisplayName;
  }
  if (normalized.customerPhone) {
    metadata.customer_phone = normalized.customerPhone;
  }
  if (normalized.customerHandle) {
    metadata.customer_handle = normalized.customerHandle;
  }

  const msg = await createMessage(
    {
      dealershipId,
      conversationId: conversation.id,
      senderType: "customer",
      body: text,
      rawPayload: buildStoredRawPayload(normalized),
      deliveryStatus: "delivered",
      twilioInboundSid: twilioSid,
      metadata: metadata as Json,
      inboundEventExtras: {
        channel: normalized.channel,
        external_message_id: externalMessageId,
        ...(twilioSid ? { twilio_message_sid: twilioSid } : {}),
        new_conversation: createdNewConversation,
      },
    },
    supabase
  );

  if (!msg.ok) {
    return msg;
  }

  const refreshed = await getConversationRowById(dealershipId, conversation.id, supabase);
  if (!refreshed.ok) {
    return refreshed;
  }

  await runPostInboundMessageHooks({
    db: supabase,
    dealershipId,
    conversationId: conversation.id,
    messageId: msg.data.id,
    normalized,
  });

  return ok({
    duplicate: false,
    conversation: refreshed.data,
    message: msg.data,
    createdNewConversation,
  });
}
