import type { ConversationChannel } from "@/integrations/supabase/database.types";
import type { StaffDepartment } from "@/integrations/supabase/database.types";

/**
 * Product-facing channel (adapters). Maps to `conversations.channel` inside
 * {@link applyInboundMessage} — DB may collapse surfaces (e.g. Messenger + Instagram → `facebook`).
 */
export type InboundProductChannel =
  | "web_chat"
  | "sms"
  | "messenger"
  | "instagram"
  | "whatsapp";

/**
 * Canonical inbound shape after a provider adapter parses its webhook/API payload (no I/O).
 * Matches the shared inbox contract; adapters only fill these fields.
 */
export type InboundNormalizedCore = {
  externalMessageId: string;
  channel: InboundProductChannel;
  channelAccountId?: string;
  customerPhone?: string;
  customerHandle?: string;
  customerDisplayName?: string;
  text: string;
  timestamp: string;
  rawPayload: unknown;
  /**
   * Twilio `MessageSid` (and global dedupe key). Optional for non-Twilio channels.
   * When set, must match `externalMessageId` if that field already carries the SID.
   */
  twilioInboundSid?: string | null;
};

/**
 * Full input to {@link applyInboundMessage}: core fields plus tenant scope and optional routing.
 *
 * - `dealershipId` — always required for persistence (e.g. Twilio adapter resolves from `To` before apply).
 * - `targetConversationId` — when the thread already exists (web widget, resumed DMs). If omitted, the
 *   pipeline finds or creates the active open-queue conversation for the resolved customer + DB channel.
 */
export type NormalizedInboundMessage = InboundNormalizedCore & {
  dealershipId: string;
  /** Optional routing hint for new thread creation (e.g. Twilio line mapped to Service). */
  routeDepartment?: StaffDepartment | null;
  targetConversationId?: string;
};

export function toDbConversationChannel(
  channel: InboundProductChannel
): ConversationChannel {
  switch (channel) {
    case "web_chat":
      return "web_chat";
    case "sms":
      return "sms";
    case "messenger":
    case "instagram":
      return "facebook";
    case "whatsapp":
      return "other";
  }
}
