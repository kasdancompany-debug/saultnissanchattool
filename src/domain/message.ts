import type { ConversationId, MessageId, StaffUserId } from "./ids";

export type MessageDirection = "inbound" | "outbound";

export type MessageSenderType = "customer" | "staff" | "system" | "ai";

export interface Message {
  id: MessageId;
  conversationId: ConversationId;
  direction: MessageDirection;
  senderType: MessageSenderType;
  /** Set when staff or system sends; null for inbound customer web/SMS as anonymous until identified. */
  staffUserId: StaffUserId | null;
  body: string;
  /** ISO 8601 UTC */
  sentAt: string;
  /** Delivery metadata (Twilio SID, etc.) lives in integration layer / DB JSON — not on core domain type. */
  createdAt: string;
}
