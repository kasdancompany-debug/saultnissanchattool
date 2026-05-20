export const INBOX_INSERT_DRAFT_EVENT = "inbox:insert-draft";

export type InboxInsertDraftDetail = {
  text: string;
};

export function dispatchInboxInsertDraft(text: string): void {
  if (typeof window === "undefined") {
    return;
  }
  window.dispatchEvent(
    new CustomEvent<InboxInsertDraftDetail>(INBOX_INSERT_DRAFT_EVENT, {
      detail: { text },
    })
  );
}
