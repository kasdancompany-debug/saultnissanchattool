"use client";

import { startTransition, useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

import {
  deleteConversationsForeverAction,
  deleteConversationsInitialState,
} from "@/app/(dashboard)/inbox/delete-conversations-action";
import { markInboxClientRefreshed } from "@/lib/inbox-client-refresh-coord";
import { buildInboxHref } from "@/components/inbox/inbox-params";
import type { InboxFilter } from "@/lib/inbox/inbox-filter";
import type { InboxSort } from "@/lib/inbox/inbox-sort";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  conversationIds: string[];
  filter: InboxFilter;
  sort: InboxSort;
  assigneeScopeUserId: string | null;
  onDeleted?: () => void;
  size?: "sm" | "default";
  className?: string;
  label?: string;
};

export function InboxDeleteForeverControl({
  conversationIds,
  filter,
  sort,
  assigneeScopeUserId,
  onDeleted,
  size = "sm",
  className,
  label,
}: Props) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [state, formAction, isPending] = useActionState(
    deleteConversationsForeverAction,
    deleteConversationsInitialState
  );

  const count = conversationIds.length;
  const disabled = count === 0;

  const listHref = buildInboxHref(filter, {
    ownerUserId: assigneeScopeUserId,
    sort,
    conversationId: null,
  });

  useEffect(() => {
    if (!state.ok) {
      return;
    }
    setConfirming(false);
    onDeleted?.();
    startTransition(() => {
      if (window.location.search.includes("c=")) {
        router.replace(listHref);
      }
      router.refresh();
      markInboxClientRefreshed();
    });
  }, [state.ok, onDeleted, listHref, router]);

  const errorAlert = state.error ? (
    <p
      className="text-destructive w-full text-[11px] font-medium leading-snug"
      role="alert"
    >
      {state.error}
    </p>
  ) : null;

  if (confirming) {
    return (
      <div className={cn("flex w-full min-w-0 flex-col gap-2", className)}>
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-2.5 py-2">
          <p className="text-destructive min-w-0 flex-1 text-[11px] font-medium leading-snug">
            Permanently delete {count === 1 ? "this conversation" : `${count} conversations`}?
            Messages and history cannot be recovered.
          </p>
          <form action={formAction} className="flex shrink-0 items-center gap-1.5">
            <input type="hidden" name="filter" value={filter} />
            <input type="hidden" name="sort" value={sort} />
            <input
              type="hidden"
              name="assigneeScopeUserId"
              value={assigneeScopeUserId ?? ""}
            />
            <input
              type="hidden"
              name="conversationIds"
              value={JSON.stringify(conversationIds)}
            />
            <Button
              type="button"
              variant="ghost"
              size={size}
              className="h-8 px-2 text-[11px]"
              disabled={isPending}
              onClick={() => setConfirming(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="destructive"
              size={size}
              className="h-8 gap-1 px-2.5 text-[11px] font-semibold"
              disabled={isPending || disabled}
            >
              {isPending ? "Deleting…" : "Delete forever"}
            </Button>
          </form>
        </div>
        {errorAlert}
      </div>
    );
  }

  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <Button
        type="button"
        variant="destructive"
        size={size}
        className="h-8 gap-1.5 px-2.5 text-[11px] font-semibold"
        disabled={disabled || isPending}
        onClick={() => setConfirming(true)}
      >
        <Trash2 className="size-3.5 shrink-0" aria-hidden />
        {label ?? (count === 1 ? "Delete forever" : `Delete forever (${count})`)}
      </Button>
      {errorAlert}
    </div>
  );
}
