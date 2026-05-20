import type { InboxMessageView } from "@/server/data/inbox";
import type { InboxChannelSurfaceId } from "@/lib/conversation/inbox-channel-surface";
import { inboxChannelThreadEmptyBody } from "@/lib/conversation/inbox-channel-ux";
import { InboxRetryFailedMessageForm } from "./inbox-retry-failed-message-form";

import { formatMessageTimestamp } from "@/lib/format-time";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

function bubblePlacement(senderType: InboxMessageView["sender_type"]) {
  if (senderType === "customer") {
    return "mr-auto items-start text-left";
  }
  if (senderType === "staff") {
    return "ml-auto items-end text-right";
  }
  return "mx-auto items-center text-center";
}

function bubbleStyle(senderType: InboxMessageView["sender_type"]) {
  if (senderType === "customer") {
    return "border border-border bg-card text-foreground shadow-[0_1px_2px_rgba(15,23,42,0.06),0_4px_14px_-3px_rgba(15,23,42,0.09)]";
  }
  if (senderType === "staff") {
    return "bg-primary/[0.1] text-foreground shadow-[0_2px_10px_-2px_rgba(15,23,42,0.06)]";
  }
  return "bg-secondary text-muted-foreground shadow-[inset_0_1px_1px_rgba(15,23,42,0.03)]";
}

function deliveryBadge(message: InboxMessageView): {
  label: string;
  tone: "neutral" | "success" | "warning" | "danger";
} | null {
  if (message.sender_type !== "staff") {
    return null;
  }
  switch (message.delivery_status) {
    case "pending":
    case "queued":
      return { label: "Sending...", tone: "warning" };
    case "sent":
      return { label: "Sent", tone: "neutral" };
    case "delivered":
      return { label: "Delivered", tone: "success" };
    case "read":
      return { label: "Read", tone: "success" };
    case "failed":
      return { label: "Failed", tone: "danger" };
    default:
      return null;
  }
}

function transportError(message: InboxMessageView): string | null {
  if (message.sender_type !== "staff" || message.delivery_status !== "failed") {
    return null;
  }
  const metadata =
    typeof message.metadata === "object" &&
    message.metadata !== null &&
    !Array.isArray(message.metadata)
      ? (message.metadata as Record<string, unknown>)
      : null;
  const transport =
    metadata &&
    typeof metadata.transport === "object" &&
    metadata.transport !== null &&
    !Array.isArray(metadata.transport)
      ? (metadata.transport as Record<string, unknown>)
      : null;
  const error = transport?.error;
  return typeof error === "string" && error.trim() ? error.trim() : null;
}

export function InboxThreadMessages({
  messages,
  channelSurface,
  conversationId,
}: {
  messages: InboxMessageView[];
  channelSurface: InboxChannelSurfaceId;
  conversationId: string;
}) {
  return (
    <div className="space-y-4 px-4 py-4 sm:px-5 sm:py-4">
      {messages.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-20 text-center">
          <p className="text-foreground text-sm font-medium">No messages yet</p>
          <p className="text-muted-foreground max-w-sm text-xs leading-relaxed">
            {inboxChannelThreadEmptyBody(channelSurface)}
          </p>
        </div>
      ) : (
        messages.map((m, index) => {
          const placement = bubblePlacement(m.sender_type);
          const isNarrow = m.sender_type === "system" || m.sender_type === "ai";
          const delivery = deliveryBadge(m);
          const sendError = transportError(m);

          return (
            <div
              key={`${m.id}-${index}`}
              className={cn("flex w-full flex-col gap-1", placement)}
            >
              <div
                className={cn(
                  "flex max-w-[min(100%,520px)] flex-col gap-1 rounded-2xl px-4 py-3",
                  bubbleStyle(m.sender_type),
                  isNarrow && "max-w-md"
                )}
              >
                <div className="text-muted-foreground flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-[11px]">
                  <span className="text-foreground font-medium">
                    {m.sender_label}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {delivery ? (
                      <Badge
                        variant="outline"
                        className={cn(
                          "h-5 px-1.5 text-[10px] font-semibold transition-[background-color,border-color,color,transform,opacity] duration-300 ease-out motion-reduce:transition-none animate-in fade-in zoom-in-95",
                          delivery.tone === "success" &&
                            "border-emerald-300/80 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/45 dark:text-emerald-100",
                          delivery.tone === "warning" &&
                            "border-amber-300/80 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/45 dark:text-amber-100",
                          delivery.tone === "danger" &&
                            "border-rose-300/80 bg-rose-50 text-rose-950 dark:border-rose-800 dark:bg-rose-950/45 dark:text-rose-100"
                        )}
                      >
                        {delivery.label}
                      </Badge>
                    ) : null}
                    <time className="tabular-nums opacity-80" dateTime={m.created_at}>
                      {formatMessageTimestamp(m.created_at)}
                    </time>
                  </div>
                </div>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">
                  {(m.body ?? "").trim() === "" ? (
                    <span className="text-muted-foreground italic">
                      Empty message
                    </span>
                  ) : (
                    (m.body ?? "")
                  )}
                </p>
                {sendError ? (
                  <p className="text-[11px] text-rose-700 dark:text-rose-300">
                    Send error: {sendError}
                  </p>
                ) : null}
                {m.sender_type === "staff" && m.delivery_status === "failed" ? (
                  <InboxRetryFailedMessageForm
                    conversationId={conversationId}
                    messageId={m.id}
                  />
                ) : null}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
