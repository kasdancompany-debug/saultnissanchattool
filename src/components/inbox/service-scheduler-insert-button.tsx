"use client";

import { useState, useTransition } from "react";
import { Wrench } from "lucide-react";

import { insertServiceSchedulerLinkAction } from "@/app/(dashboard)/inbox/service-scheduler-actions";
import { dispatchInboxInsertDraft } from "@/lib/inbox/inbox-draft";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ServiceSchedulerInsertButton({
  conversationId,
  label,
  className,
  size = "sm",
  variant = "secondary",
}: {
  conversationId: string;
  label: string;
  className?: string;
  size?: "sm" | "default";
  variant?: "secondary" | "outline";
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const onClick = () => {
    setError(null);
    startTransition(async () => {
      const res = await insertServiceSchedulerLinkAction(conversationId);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      if (res.messageText) {
        dispatchInboxInsertDraft(res.messageText);
        document
          .getElementById("inbox-reply-form")
          ?.scrollIntoView({ behavior: "smooth" });
      }
    });
  };

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <Button
        type="button"
        size={size}
        variant={variant}
        className={cn(
          "w-full",
          size === "sm" && variant === "secondary"
            ? "h-auto rounded-full px-3 py-1.5 text-xs sm:w-auto"
            : "h-9 justify-start gap-1.5"
        )}
        disabled={isPending}
        onClick={onClick}
      >
        <Wrench className="size-3.5 shrink-0 opacity-70" aria-hidden />
        {isPending ? "Inserting…" : label}
      </Button>
      {error ? (
        <p className="text-destructive text-[11px] leading-snug" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
