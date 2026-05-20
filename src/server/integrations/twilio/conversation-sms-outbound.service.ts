import "server-only";

import type { Database, Json } from "@/integrations/supabase/database.types";
import { getConversationRowById } from "@/server/data/conversations";
import { insertConversationEvent } from "@/server/data/conversation-events";
import { getTwilioSmsFromE164ForDealership } from "@/server/data/dealership-channel-accounts";
import { createMessage, type MessageRow } from "@/server/data/messages";
import { resolveDb } from "@/server/data/internal";
import { fromPostgrestError } from "@/server/data/postgrest-error";
import type { TypedSupabaseClient } from "@/server/db/server-client";
import { ensureStaffHumanControlOnReply } from "@/server/messaging/ensure-staff-human-control";
import { err, ok, type Result } from "@/server/result";

import { sendTwilioOutboundSms } from "./send-outbound-sms";

const BLOCKED_REPLY_STATUSES: Database["public"]["Enums"]["conversation_status"][] = [
  "closed",
  "archived",
  "spam",
];

function nextStatusAfterStaffReply(
  current: Database["public"]["Enums"]["conversation_status"]
): { next: Database["public"]["Enums"]["conversation_status"]; changed: boolean } {
  if (current === "pending") {
    return { next: "open", changed: true };
  }
  if (current === "waiting_for_human") {
    return { next: "open", changed: true };
  }
  if (current === "resolved") {
    return { next: "open", changed: true };
  }
  if (current === "open") {
    return { next: "open", changed: false };
  }
  return { next: current, changed: false };
}

export type SendStaffSmsForConversationInput = {
  dealershipId: string;
  conversationId: string;
  staffUserId: string;
  /** E.164 destination (inbox typically passes `customers.phone_e164`). */
  to: string;
  /** Message body (already trimmed by caller). */
  body: string;
  /** Twilio `From` E.164; defaults to `dealerships.twilio_phone_e164`, then env default. */
  fromE164?: string | null;
};

export type SendStaffSmsForConversationResult = {
  message: MessageRow;
  /** Present when Twilio accepted the send (`delivery_status` updated to `sent`). */
  twilio?: {
    sid: string;
    from: string;
    to: string;
  };
};

/**
 * Resolves the customer's SMS destination for an SMS thread (E.164).
 */
export async function resolveSmsRecipientForConversation(
  dealershipId: string,
  conversationId: string,
  db?: TypedSupabaseClient
): Promise<Result<string>> {
  const supabase = await resolveDb(db);
  const conv = await getConversationRowById(dealershipId, conversationId, supabase);
  if (!conv.ok) {
    return conv;
  }
  if (!conv.data.customer_id) {
    return err("NO_CUSTOMER", "SMS conversation has no linked customer.");
  }
  const cust = await supabase
    .from("customers")
    .select("phone_e164")
    .eq("id", conv.data.customer_id)
    .maybeSingle();
  if (cust.error) {
    return err("DB_ERROR", cust.error.message);
  }
  const to = cust.data?.phone_e164?.trim();
  if (!to) {
    return err("NO_PHONE", "Customer has no phone number on file for SMS.");
  }
  return ok(to);
}

/**
 * Backend-only staff SMS for a conversation: persist `messages` (staff + `human_reply_sent` event via
 * {@link createMessage}), send via Twilio REST, then update `twilio_outbound_sid` and `delivery_status`.
 *
 * Inbox should call {@link import("@/server/messaging/send-staff-reply").sendStaffReply} which delegates here
 * for `sms` channels; use this function directly when you already know `to` (e.g. tests or automation).
 *
 * Never import from client components — Twilio runs only on the server.
 */
export async function sendStaffSmsForConversation(
  input: SendStaffSmsForConversationInput,
  db?: TypedSupabaseClient
): Promise<Result<SendStaffSmsForConversationResult>> {
  const supabase = await resolveDb(db);
  const now = new Date().toISOString();

  const convRes = await getConversationRowById(
    input.dealershipId,
    input.conversationId,
    supabase
  );
  if (!convRes.ok) {
    return convRes;
  }
  const conv = convRes.data;
  if (conv.channel !== "sms") {
    return err("VALIDATION", "Conversation is not an SMS thread.");
  }
  if (BLOCKED_REPLY_STATUSES.includes(conv.status)) {
    return err("FORBIDDEN", "Replies are not allowed for this conversation.");
  }

  const statusPlan = nextStatusAfterStaffReply(conv.status);

  const created = await createMessage(
    {
      dealershipId: input.dealershipId,
      conversationId: input.conversationId,
      senderType: "staff",
      senderUserId: input.staffUserId,
      body: input.body,
      rawPayload: {},
      deliveryStatus: "queued",
      metadata: {
        source: "staff_inbox",
        transport: {
          provider: "twilio_sms",
          phase: "queued",
        },
      },
      staffReplyEventExtras: {
        transport_provider: "twilio_sms",
      },
    },
    supabase
  );

  if (!created.ok) {
    return created;
  }

  let message = created.data;

  const humanControl = await ensureStaffHumanControlOnReply(
    supabase,
    input.dealershipId,
    input.conversationId,
    input.staffUserId
  );
  if (!humanControl.ok) {
    return humanControl;
  }

  const convUpdate: Database["public"]["Tables"]["conversations"]["Update"] = {
    updated_at: now,
  };
  if (statusPlan.changed) {
    convUpdate.status = statusPlan.next;
  }

  const touch = await supabase
    .from("conversations")
    .update(convUpdate)
    .eq("dealership_id", input.dealershipId)
    .eq("id", input.conversationId);

  if (touch.error) {
    return err("CONVERSATION_UPDATE_FAILED", touch.error.message);
  }

  if (statusPlan.changed) {
    const statusEvent = await insertConversationEvent(supabase, {
      conversation_id: input.conversationId,
      event_type: "status_changed",
      actor_user_id: input.staffUserId,
      payload: {
        previous_status: conv.status,
        new_status: statusPlan.next,
        reason: "staff_reply",
      },
    });
    if (!statusEvent.ok) {
      return statusEvent;
    }
  }

  const fromChannel = await getTwilioSmsFromE164ForDealership(input.dealershipId, supabase);
  if (!fromChannel.ok) {
    return fromChannel;
  }

  let fromLine = input.fromE164?.trim() || fromChannel.data || undefined;
  if (!fromLine) {
    const dealership = await supabase
      .from("dealerships")
      .select("twilio_phone_e164")
      .eq("id", input.dealershipId)
      .maybeSingle();

    if (dealership.error) {
      return err("DB_ERROR", dealership.error.message);
    }
    fromLine = dealership.data?.twilio_phone_e164?.trim() || undefined;
  }

  const to = input.to.trim();
  const sent = await sendTwilioOutboundSms({
    to,
    body: message.body,
    ...(fromLine ? { from: fromLine } : {}),
  });

  if (!sent.ok) {
    const fail = await supabase
      .from("messages")
      .update({
        delivery_status: "failed",
        updated_at: new Date().toISOString(),
        metadata: {
          ...(typeof message.metadata === "object" && message.metadata !== null
            ? (message.metadata as Record<string, unknown>)
            : {}),
          transport: {
            provider: "twilio_sms",
            phase: "failed",
            error: sent.error.message,
            code: sent.error.code,
          },
        },
      })
      .eq("id", message.id)
      .select()
      .single();

    if (fail.error || !fail.data) {
      return err("MESSAGE_DISPATCH_FAILED", sent.error.message);
    }
    return ok({ message: fail.data });
  }

  const providerSid = sent.data.sid;
  const twilioOutboundRaw: Json = {
    provider: "twilio",
    outbound: {
      message_sid: providerSid,
      to,
      from: sent.data.from,
      completed_at: now,
    },
  };

  const upd = await supabase
    .from("messages")
    .update({
      delivery_status: "sent",
      updated_at: new Date().toISOString(),
      twilio_outbound_sid: providerSid,
      raw_payload: twilioOutboundRaw,
      metadata: {
        ...(typeof message.metadata === "object" && message.metadata !== null
          ? (message.metadata as Record<string, unknown>)
          : {}),
        transport: {
          provider: "twilio_sms",
          phase: "sent",
          completed_at: now,
          twilio_message_sid: providerSid,
        },
      },
    })
    .eq("id", message.id)
    .select()
    .single();

  if (upd.error || !upd.data) {
    return upd.error
      ? fromPostgrestError(upd.error)
      : err("DATABASE_ERROR", "Failed to update message after Twilio send.");
  }

  message = upd.data;
  return ok({
    message,
    twilio: { sid: providerSid, from: sent.data.from, to },
  });
}
