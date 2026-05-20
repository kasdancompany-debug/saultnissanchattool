import "server-only";

import type { Json, MessageDeliveryStatus } from "@/integrations/supabase/database.types";
import {
  mapTwilioMessageStatusToDelivery,
  parseTwilioStatusCallbackPayload,
} from "@/integrations/twilio/status-callback";
import { createSupabaseAdminClient } from "@/integrations/supabase/admin";
import { captureServerException } from "@/lib/observability/server-capture";
import { insertConversationEvent } from "@/server/data/conversation-events";
import { err, ok, type Result } from "@/server/result";

export type ApplyTwilioMessageStatusResult = {
  /** Row updated (or metadata refreshed). */
  updated: boolean;
  /** `metadata_changed` event when `delivery_status` transitioned. */
  eventLogged: boolean;
};

/**
 * Applies Twilio outbound message status callbacks: update `messages` by `twilio_outbound_sid`,
 * merge transport metadata (idempotent under retries), optionally log a conversation event when
 * **`delivery_status`** changes.
 *
 * **Not found:** if no row matches `MessageSid`, returns **`ok({ updated: false, eventLogged: false })`**
 * (no error — unknown SIDs can occur for test sends or DB drift).
 */
export async function applyTwilioMessageStatus(
  raw: Record<string, string>
): Promise<Result<ApplyTwilioMessageStatusResult>> {
  const parsed = parseTwilioStatusCallbackPayload(raw);
  if (!parsed) {
    return err("VALIDATION", "Missing MessageSid or MessageStatus");
  }

  const { messageSid: MessageSid, messageStatus: MessageStatus, errorCode } = parsed;

  const supabase = createSupabaseAdminClient();

  const existing = await supabase
    .from("messages")
    .select("id, conversation_id, metadata, delivery_status")
    .eq("twilio_outbound_sid", MessageSid)
    .maybeSingle();

  if (existing.error) {
    return err("DB_ERROR", existing.error.message);
  }
  if (!existing.data) {
    return ok({ updated: false, eventLogged: false });
  }

  const mapped = mapTwilioMessageStatusToDelivery(MessageStatus);
  const prevDelivery = existing.data.delivery_status as MessageDeliveryStatus | null;
  const deliveryChanged =
    mapped !== null && mapped !== prevDelivery;

  const prevMeta =
    typeof existing.data.metadata === "object" &&
    existing.data.metadata !== null &&
    !Array.isArray(existing.data.metadata)
      ? (existing.data.metadata as Record<string, unknown>)
      : {};

  const nextMeta = {
    ...prevMeta,
    transport: {
      ...(typeof prevMeta.transport === "object" &&
      prevMeta.transport !== null &&
      !Array.isArray(prevMeta.transport)
        ? (prevMeta.transport as Record<string, unknown>)
        : {}),
      provider: "twilio",
      last_twilio_status: MessageStatus,
      last_twilio_status_at: new Date().toISOString(),
      twilio_error_code: errorCode ?? raw.ErrorCode ?? null,
    },
  };

  const patch: {
    delivery_status?: MessageDeliveryStatus;
    metadata: typeof nextMeta;
    updated_at: string;
  } = {
    metadata: nextMeta,
    updated_at: new Date().toISOString(),
  };

  if (mapped) {
    patch.delivery_status = mapped;
  }

  const upd = await supabase
    .from("messages")
    .update(patch)
    .eq("id", existing.data.id)
    .select("id")
    .maybeSingle();

  if (upd.error) {
    return err("DB_ERROR", upd.error.message);
  }

  let eventLogged = false;
  if (deliveryChanged && mapped !== null) {
    const ev = await insertConversationEvent(supabase, {
      conversation_id: existing.data.conversation_id,
      event_type: "metadata_changed",
      actor_user_id: null,
      payload: {
        kind: "twilio_delivery_status",
        message_id: existing.data.id,
        twilio_message_sid: MessageSid,
        twilio_message_status: MessageStatus,
        previous_delivery_status: prevDelivery,
        next_delivery_status: mapped,
      } as Json,
    });
    if (!ev.ok) {
      captureServerException(new Error(ev.error.message), {
        route: "applyTwilioMessageStatus",
        code: ev.error.code,
        conversationId: existing.data.conversation_id,
        messageId: existing.data.id,
      });
    } else {
      eventLogged = true;
    }
  }

  return ok({ updated: true, eventLogged });
}
