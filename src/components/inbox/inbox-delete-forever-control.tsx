"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

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
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const count = conversationIds.length;
  const disabled = count === 0;

  const listHref = buildInboxHref(filter, {
    ownerUserId: assigneeScopeUserId,
    sort,
    conversationId: null,
  });

  const runDelete = () => {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/inbox/delete-conversations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conversationIds }),
        });
        const data = (await res.json()) as {
          ok?: boolean;
          error?: string | null;
          deletedCount?: number;
        };

        if (!res.ok || !data.ok) {
          setError(data.error ?? "Could not delete conversations.");
          return;
        }

        setConfirming(false);
        onDeleted?.();
        if (window.location.search.includes("c=")) {
          router.replace(listHref);
        }
        router.refresh();
        markInboxClientRefreshed();
      } catch (e) {
        setError(
          e instanceof Error ? e.message : "Could not delete conversations."
        );
      }
    });
  };

  const errorAlert = error ? (
    <p
      className="text-destructive w-full text-[11px] font-medium leading-snug"
      role="alert"
    >
      {error}
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
          <div className="flex shrink-0 items-center gap-1.5">
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
              type="button"
              variant="destructive"
              size={size}
              className="h-8 gap-1 px-2.5 text-[11px] font-semibold"
              disabled={isPending || disabled}
              onClick={runDelete}
            >
              {isPending ? "Deleting…" : "Delete forever"}
            </Button>
          </div>
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
        onClick={() => {
          setError(null);
          setConfirming(true);
        }}
      >
        <Trash2 className="size-3.5 shrink-0" aria-hidden />
        {label ?? (count === 1 ? "Delete forever" : `Delete forever (${count})`)}
      </Button>
      {errorAlert}
    </div>
  );
}
