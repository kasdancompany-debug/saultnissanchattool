import type {
  ConversationStatus,
  Database,
  Json,
} from "@/integrations/supabase/database.types";
import { getConversationRowById } from "@/server/data/conversations";
import { insertConversationEvent } from "@/server/data/conversation-events";
import { createMessage, type MessageRow } from "@/server/data/messages";
import { resolveDb } from "@/server/data/internal";
import { fromPostgrestError } from "@/server/data/postgrest-error";
import type { TypedSupabaseClient } from "@/server/db/server-client";
import {
  resolveSmsRecipientForConversation,
  sendStaffSmsForConversation,
} from "@/server/integrations/twilio/conversation-sms-outbound.service";
import { err, ok, type Result } from "@/server/result";

import { ensureStaffHumanControlOnReply } from "@/server/messaging/ensure-staff-human-control";
import { maybeRecordServiceSchedulerLinkOnStaffSend } from "@/server/service-scheduler/service-scheduler-link";
import { resolveStaffReplyDeliveryStrategy } from "./outbound/channel-outbound-policy";

const BLOCKED_REPLY_STATUSES: ConversationStatus[] = [
  "closed",
  "archived",
  "spam",
];

function nextStatusAfterStaffReply(
  current: ConversationStatus
): { next: ConversationStatus; changed: boolean } {
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

export type SendStaffReplyInput = {
  dealershipId: string;
  conversationId: string;
  staffUserId: string;
  /** Already validated + normalized body */
  body: string;
};

/**
 * Persists a staff reply (`sender_type = staff`, `sender_user_id` set), records a
 * `human_reply_sent` conversation_event, stamps human-led control when needed, updates
 * conversation status/`updated_at` when needed,
 * and delivers via {@link resolveStaffReplyDeliveryStrategy} (`sms` → Twilio integration; other channels → transport `dispatch`).
 *
 * **SMS** threads use {@link sendStaffSmsForConversation} (Twilio REST + message row updates) — never call Twilio from UI.
 *
 * `conversations.last_message_at` is maintained by the DB trigger on `messages` insert;
 * this flow does not duplicate that bump.
 */
export async function sendStaffReply(
  input: SendStaffReplyInput,
  db?: TypedSupabaseClient
): Promise<Result<MessageRow>> {
  const supabase = await resolveDb(db);

  const convRes = await getConversationRowById(
    input.dealershipId,
    input.conversationId,
    supabase
  );
  if (!convRes.ok) {
    return convRes;
  }

  const conv = convRes.data;
  if (BLOCKED_REPLY_STATUSES.includes(conv.status)) {
    return err("FORBIDDEN", "Replies are not allowed for this conversation.");
  }

  const delivery = resolveStaffReplyDeliveryStrategy(conv.channel);

  if (delivery.kind === "sms_twilio_integration") {
    const toRes = await resolveSmsRecipientForConversation(
      input.dealershipId,
      input.conversationId,
      supabase
    );
    if (!toRes.ok) {
      return err(toRes.error.code, toRes.error.message);
    }
    const smsRes = await sendStaffSmsForConversation(
      {
        dealershipId: input.dealershipId,
        conversationId: input.conversationId,
        staffUserId: input.staffUserId,
        to: toRes.data,
        body: input.body,
      },
      supabase
    );
    if (!smsRes.ok) {
      return err(smsRes.error.code, smsRes.error.message);
    }
    const schedulerEvent = await maybeRecordServiceSchedulerLinkOnStaffSend(
      {
        dealershipId: input.dealershipId,
        conversationId: input.conversationId,
        staffUserId: input.staffUserId,
        body: input.body,
      },
      supabase
    );
    if (!schedulerEvent.ok) {
      console.warn(
        "[send-staff-reply] service_scheduler_link_sent event failed",
        schedulerEvent.error.message
      );
    }
    return ok(smsRes.data.message);
  }

  const transport = delivery.transport;
  const now = new Date().toISOString();
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
          provider: transport.id,
          phase: "queued",
        },
      },
      staffReplyEventExtras: {
        transport_provider: transport.id,
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

  const dispatch = await transport.dispatch({
    dealershipId: input.dealershipId,
    conversationId: input.conversationId,
    messageId: message.id,
    body: message.body,
    channel: conv.channel,
  });

  const providerSid =
    dispatch.ok && dispatch.providerMessageId
      ? dispatch.providerMessageId
      : null;

  const twilioOutboundRaw: Json | null =
    dispatch.ok && providerSid && dispatch.twilio
      ? ({
          provider: "twilio",
          outbound: {
            message_sid: providerSid,
            to: dispatch.twilio.to,
            from: dispatch.twilio.from,
            completed_at: now,
          },
        } as Json)
      : null;

  if (!dispatch.ok) {
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
            provider: transport.id,
            phase: "failed",
            error: dispatch.message,
            code: dispatch.code,
          },
        },
      })
      .eq("id", message.id)
      .select()
      .single();

    if (fail.error || !fail.data) {
      return err("MESSAGE_DISPATCH_FAILED", dispatch.message);
    }
    return ok(fail.data);
  }

  const sent = await supabase
    .from("messages")
    .update({
      delivery_status: "sent",
      updated_at: new Date().toISOString(),
      twilio_outbound_sid: providerSid,
      ...(twilioOutboundRaw ? { raw_payload: twilioOutboundRaw } : {}),
      metadata: {
        ...(typeof message.metadata === "object" && message.metadata !== null
          ? (message.metadata as Record<string, unknown>)
          : {}),
        transport: {
          provider: transport.id,
          phase: "sent",
          completed_at: now,
          ...(providerSid ? { twilio_message_sid: providerSid } : {}),
        },
      },
    })
    .eq("id", message.id)
    .select()
    .single();

  if (sent.error || !sent.data) {
    return fromPostgrestError(sent.error);
  }

  message = sent.data;

  const schedulerEvent = await maybeRecordServiceSchedulerLinkOnStaffSend(
    {
      dealershipId: input.dealershipId,
      conversationId: input.conversationId,
      staffUserId: input.staffUserId,
      body: input.body,
    },
    supabase
  );
  if (!schedulerEvent.ok) {
    console.warn(
      "[send-staff-reply] service_scheduler_link_sent event failed",
      schedulerEvent.error.message
    );
  }

  return ok(message);
}
