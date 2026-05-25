"use client";

import {
  startTransition,
  useActionState,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";

import { markInboxClientRefreshed } from "@/lib/inbox-client-refresh-coord";
import {
  INBOX_INSERT_DRAFT_EVENT,
  type InboxInsertDraftDetail,
} from "@/lib/inbox/inbox-draft";

import {
  sendInboxReplyAction,
} from "@/app/(dashboard)/inbox/actions";
import {
  inboxReplyInitialState,
  type InboxReplyActionState,
} from "@/app/(dashboard)/inbox/action-states";

import { STAFF_MESSAGE_MAX_CHARS } from "@/lib/staff-message-limits";
import type { InboxMessageView } from "@/lib/inbox/inbox-message-view";
import type { InboxChannelSurfaceId } from "@/lib/conversation/inbox-channel-surface";
import { inboxChannelReplyFootnote } from "@/lib/conversation/inbox-channel-ux";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const AVAILABILITY_RE = /\b(avail|available|stock|in stock|still have|still got)\b/i;
const APPOINTMENT_RE = /\b(test drive|appointment|book|booking|schedule|come in)\b/i;
const PRICE_RE = /\b(price|pricing|cost|payment|finance|lease|rate)\b/i;
const TRADE_RE = /\b(trade|trade-in|trade in)\b/i;

function normalizeQuickReply(reply: string): string {
  return reply.length > STAFF_MESSAGE_MAX_CHARS
    ? reply.slice(0, STAFF_MESSAGE_MAX_CHARS)
    : reply;
}

function buildQuickReplySuggestions(latestInbound: string): string[] {
  const text = latestInbound.toLowerCase();

  const booking =
    "Happy to help - would you like me to get you booked for a quick appointment or test drive?";
  const moreInfo =
    "Great question. Could you share the exact model, trim, and year you want so I can confirm details for you?";
  const availability =
    "Thanks for checking in. I can confirm current availability for you right now - which vehicle are you interested in?";

  const suggestions = new Set<string>();

  if (AVAILABILITY_RE.test(text)) {
    suggestions.add(
      "Yes, I can check availability for you now. Which model and trim should I confirm?"
    );
  } else {
    suggestions.add(availability);
  }

  if (APPOINTMENT_RE.test(text)) {
    suggestions.add(
      "Absolutely - I can get that appointment set up. What day and time works best for you?"
    );
  } else {
    suggestions.add(booking);
  }

  if (PRICE_RE.test(text) || TRADE_RE.test(text)) {
    suggestions.add(
      "I can pull that together for you. Could you share a few details so I can get the most accurate numbers?"
    );
  } else {
    suggestions.add(moreInfo);
  }

  return Array.from(suggestions).slice(0, 3).map(normalizeQuickReply);
}

export function InboxComposer({
  conversationId,
  messages,
  channelSurface,
  canReply,
  disabledReason,
}: {
  conversationId: string;
  messages: InboxMessageView[];
  /** Shown in composer footnote only; does not change submission or API. */
  channelSurface: InboxChannelSurfaceId;
  canReply: boolean;
  disabledReason?: string;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [body, setBody] = useState("");
  const [state, formAction, isPending] = useActionState<
    InboxReplyActionState,
    FormData
  >(sendInboxReplyAction, inboxReplyInitialState);
  const latestInboundMessage = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const msg = messages[i];
      if (msg.sender_type === "customer" && msg.body.trim()) {
        return msg.body.trim();
      }
    }
    return "";
  }, [messages]);
  const quickReplies = useMemo(() => {
    if (!latestInboundMessage) {
      return [];
    }
    return buildQuickReplySuggestions(latestInboundMessage);
  }, [latestInboundMessage]);

  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      setBody("");
      startTransition(() => {
        router.refresh();
        markInboxClientRefreshed();
      });
    }
  }, [state, router]);

  useEffect(() => {
    const onInsert = (event: Event) => {
      const detail = (event as CustomEvent<InboxInsertDraftDetail>).detail;
      if (!detail?.text?.trim()) return;
      setBody(detail.text);
      textareaRef.current?.focus();
    };
    window.addEventListener(INBOX_INSERT_DRAFT_EVENT, onInsert);
    return () => window.removeEventListener(INBOX_INSERT_DRAFT_EVENT, onInsert);
  }, []);

  return (
    <div className="bg-background/95 shrink-0 px-4 py-3 shadow-[0_-10px_32px_-12px_rgba(15,23,42,0.09)] backdrop-blur-md sm:px-5 dark:shadow-[0_-12px_36px_-10px_rgba(0,0,0,0.55)]">
      {!canReply ? (
        <p className="text-muted-foreground text-center text-sm">
          {disabledReason ?? "Replies are disabled for this conversation."}
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {state.error ? (
            <p
              className="text-destructive bg-destructive/5 rounded-lg border border-destructive/20 px-3 py-2 text-sm"
              role="alert"
            >
              {state.error}
            </p>
          ) : null}
          <form
            ref={formRef}
            id="inbox-reply-form"
            action={formAction}
            className="flex flex-col gap-3"
          >
            <input type="hidden" name="conversationId" value={conversationId} />
            {quickReplies.length > 0 ? (
              <div className="flex flex-wrap gap-2" aria-label="Suggested replies">
                {quickReplies.map((reply, index) => (
                  <Button
                    key={`${conversationId}-qr-${index}`}
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="h-auto rounded-full px-3 py-1.5 text-xs"
                    disabled={isPending}
                    onClick={() => {
                      setBody(reply);
                      textareaRef.current?.focus();
                    }}
                  >
                    {reply}
                  </Button>
                ))}
              </div>
            ) : null}
            <Textarea
              ref={textareaRef}
              name="body"
              rows={3}
              placeholder="Write a reply…"
              className="min-h-[88px] resize-none bg-muted/20"
              maxLength={STAFF_MESSAGE_MAX_CHARS}
              required
              disabled={isPending}
              aria-label="Reply message"
              aria-invalid={Boolean(state.error)}
              value={body}
              onChange={(event) => setBody(event.target.value)}
            />
            <div className="flex flex-col gap-1.5 sm:flex-row sm:items-end sm:justify-between sm:gap-3">
              <div className="text-muted-foreground flex min-w-0 flex-col gap-0.5 text-[11px] leading-snug">
                <span>
                  {STAFF_MESSAGE_MAX_CHARS.toLocaleString()} character max · blank
                  messages are blocked
                </span>
                <span className="text-muted-foreground/85">
                  {inboxChannelReplyFootnote(channelSurface)}
                </span>
              </div>
              <Button
                type="submit"
                size="sm"
                className="shrink-0 self-end sm:self-auto"
                disabled={isPending}
              >
                {isPending ? "Sending…" : "Send reply"}
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
