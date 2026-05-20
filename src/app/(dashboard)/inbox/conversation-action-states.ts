export type InboxConversationActionState = {
  ok: boolean;
  error: string | null;
};

export const inboxConversationInitialState: InboxConversationActionState = {
  ok: false,
  error: null,
};

export type ConversationControlModeActionState = {
  ok: boolean;
  error: string | null;
};

export const conversationControlModeInitialState: ConversationControlModeActionState =
  {
    ok: false,
    error: null,
  };
