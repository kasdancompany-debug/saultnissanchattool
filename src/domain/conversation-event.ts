import type {
  ConversationEventId,
  ConversationId,
  MessageId,
  StaffUserId,
} from "./ids";

export type ConversationEventType =
  | "conversation.created"
  | "conversation.status_changed"
  | "conversation.assigned"
  | "conversation.unassigned"
  | "control.human_takeover"
  | "control.ai_enabled"
  | "control.ai_disabled"
  | "routing.after_hours"
  | "message.inbound_received"
  | "message.outbound_sent"
  | "integration.twilio.status";

export interface ConversationEventPayloads {
  "conversation.created": { channel: string };
  "conversation.status_changed": { from: string; to: string };
  "conversation.assigned": { staffUserId: StaffUserId };
  "conversation.unassigned": Record<string, never>;
  "control.human_takeover": { staffUserId: StaffUserId };
  "control.ai_enabled": Record<string, never>;
  "control.ai_disabled": { staffUserId: StaffUserId };
  "routing.after_hours": { policy: string };
  "message.inbound_received": { messageId: MessageId };
  "message.outbound_sent": { messageId: MessageId };
  "integration.twilio.status": { providerId: string; status: string };
}

export type ConversationEventName = keyof ConversationEventPayloads;

export interface ConversationEvent {
  id: ConversationEventId;
  conversationId: ConversationId;
  type: ConversationEventName;
  payload: ConversationEventPayloads[ConversationEventName];
  actorStaffUserId: StaffUserId | null;
  /** ISO 8601 UTC */
  occurredAt: string;
}
