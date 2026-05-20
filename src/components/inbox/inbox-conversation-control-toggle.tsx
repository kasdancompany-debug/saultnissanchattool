"use client";

import { startTransition, useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";

import type { ConversationStatus } from "@/integrations/supabase/database.types";
import { getConversationResponseModeForUi } from "@/lib/conversation/control-metadata";
import { markInboxClientRefreshed } from "@/lib/inbox-client-refresh-coord";

import {
  setConversationControlModeAction,
} from "@/app/(dashboard)/inbox/control-mode-actions";
import {
  conversationControlModeInitialState,
  type ConversationControlModeActionState,
} from "@/app/(dashboard)/inbox/conversation-action-states";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function InboxConversationControlToggle({
  conversationId,
  status,
  conversationMetadata,
  aiEnabled,
  assigneeId,
  currentStaffUserId,
}: {
  conversationId: string;
  status: ConversationStatus;
  conversationMetadata: unknown;
  aiEnabled: boolean;
  assigneeId: string | null;
  currentStaffUserId: string;
}) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState<
    ConversationControlModeActionState,
    FormData
  >(setConversationControlModeAction, conversationControlModeInitialState);

  useEffect(() => {
    if (state.ok) {
      startTransition(() => {
        router.refresh();
        markInboxClientRefreshed();
      });
    }
  }, [state, router]);

  const terminal = status === "closed" || status === "archived" || status === "spam";
  const uiMode = getConversationResponseModeForUi(conversationMetadata, status);

  const canSwitchToAi =
    status !== "waiting_for_human" &&
    (!assigneeId || assigneeId === currentStaffUserId);

  if (terminal) {
    return null;
  }

  return (
    <div className="flex min-w-0 max-w-full flex-col items-end gap-1.5">
      <form
        action={formAction}
        className="bg-muted/50 inline-flex rounded-full p-0.5 shadow-inner"
        aria-label="Conversation response mode"
      >
        <input type="hidden" name="conversationId" value={conversationId} />
        <Button
          type="submit"
          name="mode"
          value="ai"
          size="sm"
          variant="ghost"
          disabled={isPending || !canSwitchToAi}
          className={cn(
            "h-8 rounded-full px-3 text-xs font-semibold",
            uiMode === "ai"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          AI mode
        </Button>
        <Button
          type="submit"
          name="mode"
          value="human"
          size="sm"
          variant="ghost"
          disabled={isPending}
          className={cn(
            "h-8 rounded-full px-3 text-xs font-semibold",
            uiMode === "human"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          Human mode
        </Button>
      </form>
      <p className="text-muted-foreground max-w-[14rem] text-right text-[10px] leading-snug">
        {!aiEnabled
          ? "AI is off for this thread — click AI mode to enable it for this conversation."
          : uiMode === "human"
            ? "Automated customer replies are paused. Human mode claims the thread when you are not the owner."
            : "Automated replies may run where policy allows (e.g. after-hours intake)."}
      </p>
      {state.error ? (
        <p
          className="text-destructive max-w-[14rem] text-right text-[10px] leading-snug"
          role="alert"
        >
          {state.error}
        </p>
      ) : null}
    </div>
  );
}
