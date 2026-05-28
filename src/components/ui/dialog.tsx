"use client";

import * as React from "react";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

type DialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
};

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
}: DialogProps) {
  const ref = React.useRef<HTMLDialogElement>(null);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) {
      return;
    }
    if (open && !el.open) {
      el.showModal();
    }
    if (!open && el.open) {
      el.close();
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={() => onOpenChange(false)}
      onCancel={(e) => {
        e.preventDefault();
        onOpenChange(false);
      }}
      className={cn(
        "border-border bg-card text-card-foreground m-auto w-[min(100%,28rem)] max-h-[min(90dvh,640px)] overflow-hidden rounded-lg border p-0 shadow-xl backdrop:bg-black/45",
        "open:animate-in open:fade-in-0 open:zoom-in-95",
        className
      )}
    >
      <div className="flex max-h-[min(90dvh,640px)] flex-col">
        <header className="border-border flex shrink-0 items-start justify-between gap-3 border-b px-4 py-3.5">
          <div className="min-w-0 space-y-0.5">
            <h2 className="text-foreground text-sm font-semibold tracking-tight">
              {title}
            </h2>
            {description ? (
              <p className="text-muted-foreground text-[12px] leading-snug">
                {description}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="text-muted-foreground hover:bg-muted hover:text-foreground rounded-sm p-1 transition-colors"
            aria-label="Close"
          >
            <X className="size-4" aria-hidden />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
          {children}
        </div>
      </div>
    </dialog>
  );
}
