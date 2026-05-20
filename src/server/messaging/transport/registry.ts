import type { ConversationChannel } from "@/integrations/supabase/database.types";

import { internalOutboundTransport } from "./internal";
import { twilioOutboundSmsTransport } from "@/server/messaging/twilio/outbound-sms-transport";

import type { OutboundTransport } from "./types";

/**
 * Low-level channel → transport for **dispatch-only** flows (message row already exists).
 *
 * Staff inbox **SMS** full pipeline is selected in {@link import("@/server/messaging/outbound/channel-outbound-policy").resolveStaffReplyDeliveryStrategy}
 * and uses `sendStaffSmsForConversation` instead of going through this registry alone.
 */
export function getOutboundTransportForChannel(
  channel: ConversationChannel
): OutboundTransport {
  if (channel === "sms") {
    return twilioOutboundSmsTransport;
  }
  return internalOutboundTransport;
}
