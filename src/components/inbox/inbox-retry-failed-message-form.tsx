"use client";

import { CheckCircle2, Loader2 } from "lucide-react";
import { startTransition, useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import {
  retryFailedInboxMessageAction,
} from "@/app/(dashboard)/inbox/actions";
import {
  inboxReplyInitialState,
  type InboxReplyActionState,
} from "@/app/(dashboard)/inbox/action-states";
import { markInboxClientRefreshed } from "@/lib/inbox-client-refresh-coord";
import { cn } from "@/lib/utils";

export function InboxRetryFailedMessageForm({
  conversationId,
  messageId,
}: {
  conversationId: string;
  messageId: string;
}) {
  const router = useRouter();
  const [showSuccessPulse, setShowSuccessPulse] = useState(false);
  const [state, formAction, isPending] = useActionState<
    InboxReplyActionState,
    FormData
  >(retryFailedInboxMessageAction, inboxReplyInitialState);

  useEffect(() => {
    if (!state.ok) {
      return;
    }
    setShowSuccessPulse(true);
    const timer = window.setTimeout(() => {
      startTransition(() => {
        router.refresh();
        markInboxClientRefreshed();
      });
      setShowSuccessPulse(false);
    }, 520);
    return () => window.clearTimeout(timer);
  }, [state, router]);

  return (
    <form
      action={formAction}
      className={cn(
        "mt-1 flex flex-col items-start gap-1.5 rounded-md border border-transparent px-2 py-1.5 transition-[opacity,background-color,border-color] duration-150",
        isPending && "border-amber-300/70 bg-amber-50/65 opacity-90 dark:border-amber-800/70 dark:bg-amber-950/30"
      )}
    >
      <input type="hidden" name="conversationId" value={conversationId} />
      <input type="hidden" name="messageId" value={messageId} />
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="text-[11px] font-semibold text-rose-700 underline underline-offset-2 hover:text-rose-800 disabled:cursor-not-allowed disabled:opacity-70 dark:text-rose-300 dark:hover:text-rose-200"
        >
          {isPending ? "Retrying..." : "Retry send"}
        </button>
        {isPending ? (
          <span className="inline-flex items-center gap-1 text-[11px] text-amber-800 dark:text-amber-200">
            <Loader2 className="size-3 animate-spin" aria-hidden />
            Retrying delivery...
          </span>
        ) : null}
        {showSuccessPulse ? (
          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 dark:text-emerald-300 animate-in fade-in duration-200">
            <CheckCircle2 className="size-3" aria-hidden />
            Retry accepted.
          </span>
        ) : null}
      </div>
      {state.error ? (
        <span className="text-[11px] text-rose-700 dark:text-rose-300">
          {state.error}
        </span>
      ) : null}
      {state.ok ? (
        <span className="text-[11px] text-emerald-700 dark:text-emerald-300">
          Retry sent.
        </span>
      ) : null}
    </form>
  );
}
