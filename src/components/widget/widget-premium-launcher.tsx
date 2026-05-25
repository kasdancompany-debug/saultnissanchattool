"use client";

import { MessageCircle } from "lucide-react";

import { cn } from "@/lib/utils";

export function WidgetPremiumLauncher({
  open,
  panelId,
  launcherId,
  launcherBtnRef,
  onToggle,
}: {
  open: boolean;
  panelId: string;
  launcherId: string;
  launcherBtnRef: React.RefObject<HTMLButtonElement | null>;
  onToggle: () => void;
}) {
  if (open) {
    return null;
  }

  return (
    <button
      ref={launcherBtnRef}
      type="button"
      id={launcherId}
      onClick={onToggle}
      className={cn(
        "pointer-events-auto flex h-14 w-14 items-center justify-center rounded-full text-white shadow-lg transition-[box-shadow,transform] duration-200 ease-out",
        "hover:shadow-xl focus-visible:ring-4 focus-visible:ring-offset-2 focus-visible:outline-none touch-manipulation",
        "active:scale-[0.98]"
      )}
      style={{ backgroundColor: "var(--widget-primary)" }}
      aria-expanded={false}
      aria-controls={panelId}
      aria-haspopup="dialog"
    >
      <MessageCircle className="size-7" strokeWidth={1.75} aria-hidden />
      <span className="sr-only">Open chat</span>
    </button>
  );
}
