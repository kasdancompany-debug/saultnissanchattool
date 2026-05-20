/** Branded id types reduce accidental cross-table swaps at compile time. */
export type OrganizationId = string & { readonly __brand: "OrganizationId" };
export type ConversationId = string & { readonly __brand: "ConversationId" };
export type MessageId = string & { readonly __brand: "MessageId" };
export type StaffUserId = string & { readonly __brand: "StaffUserId" };
export type ConversationEventId = string & { readonly __brand: "ConversationEventId" };

export function organizationId(id: string): OrganizationId {
  return id as OrganizationId;
}

export function conversationId(id: string): ConversationId {
  return id as ConversationId;
}

export function messageId(id: string): MessageId {
  return id as MessageId;
}

export function staffUserId(id: string): StaffUserId {
  return id as StaffUserId;
}

export function conversationEventId(id: string): ConversationEventId {
  return id as ConversationEventId;
}
