import "server-only";

import type { ConversationChannel } from "@/integrations/supabase/database.types";

import { getOutboundTransportForChannel } from "@/server/messaging/transport/registry";
import type { OutboundDispatchContext, OutboundTransport } from "@/server/messaging/transport/types";

/**
 * How staff reply delivery runs for a given `conversations.channel` (server-only; inbox UI never branches on this).
 *
 * | Channel | Mechanism |
 * |---------|-----------|
 * | `sms` | `sendStaffSmsForConversation` — creates the `messages` row, calls Twilio REST, sets `twilio_outbound_sid` and `delivery_status`, `human_reply_sent` via `createMessage`. |
 * | `web_chat`, `email`, `facebook`, `other` | `OutboundTransport.dispatch` after `createMessage` (see `transport/registry.ts`). Today `web_chat` uses the internal no-op transport; swap the registry mapping when you add real providers. |
 *
 * **Adding a future channel (example: WhatsApp)**  
 * 1. Extend the DB `conversation_channel` enum if required.  
 * 2. Prefer implementing an `OutboundTransport` and registering it in `getOutboundTransportForChannel` when the flow is **persist message → provider send → update row** (same as web today).  
 * 3. If the provider needs a **different orchestration** (like SMS’s all-in-one module), add a new `StaffReplyDeliveryStrategy` branch and handle it in `sendStaffReply` — keep Twilio/Meta REST out of React; only server actions call `sendStaffReply`.  
 */
export type StaffReplyDeliveryStrategy =
  | { kind: "sms_twilio_integration" }
  | { kind: "outbound_transport"; transport: OutboundTransport; channel: ConversationChannel };

export function resolveStaffReplyDeliveryStrategy(
  channel: ConversationChannel
): StaffReplyDeliveryStrategy {
  if (channel === "sms") {
    return { kind: "sms_twilio_integration" };
  }
  return {
    kind: "outbound_transport",
    transport: getOutboundTransportForChannel(channel),
    channel,
  };
}

/**
 * @deprecated Prefer {@link resolveStaffReplyDeliveryStrategy} for new code; kept for callers that only need `OutboundTransport`.
 */
export function resolveOutboundTransport(channel: ConversationChannel): OutboundTransport {
  return getOutboundTransportForChannel(channel);
}

export type { OutboundDispatchContext, OutboundTransport };
