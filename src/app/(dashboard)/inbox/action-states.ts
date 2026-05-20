export type InboxReplyActionState = {
  ok: boolean;
  error: string | null;
};

export const inboxReplyInitialState: InboxReplyActionState = {
  ok: false,
  error: null,
};
