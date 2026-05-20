import { Building2, MessageSquare } from "lucide-react";

/**
 * Dealer-facing product identity for auth screens (login, etc.).
 * Keeps the app name primary and positions the deployment context beneath it.
 */
export function AuthProductLockup() {
  return (
    <header className="mb-8 space-y-4 sm:mb-9">
      <div className="flex gap-4 sm:gap-5">
        <div
          className="from-primary to-primary/88 text-primary-foreground flex size-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br shadow-[0_1px_0_0_rgba(0,0,0,0.12),0_12px_32px_-8px_rgba(15,23,42,0.18)] sm:size-[3.25rem] dark:shadow-[0_1px_0_0_rgba(0,0,0,0.35),0_14px_36px_-6px_rgba(0,0,0,0.45)]"
          aria-hidden
        >
          <MessageSquare className="size-[1.35rem] opacity-95 sm:size-6" strokeWidth={1.75} />
        </div>
        <div className="min-w-0 flex-1 space-y-1.5 pt-0.5">
          <p className="text-primary text-[10px] font-bold tracking-[0.2em] uppercase sm:text-[11px]">
            Sault Nissan
          </p>
          <h1 className="text-foreground text-[1.375rem] font-bold tracking-[-0.045em] sm:text-[1.625rem] sm:leading-[1.15]">
            Communications Console
          </h1>
          <p className="text-muted-foreground max-w-[22rem] text-[13px] font-normal leading-relaxed sm:text-sm">
            One workspace for inbound SMS, web chat, and queue operations — built for daily staff
            workflows.
          </p>
        </div>
      </div>
      <div className="text-muted-foreground/90 flex flex-wrap items-center gap-2 text-[11px] font-medium sm:gap-2.5">
        <span className="bg-muted/60 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 shadow-[inset_0_1px_1px_rgba(15,23,42,0.04)]">
          <Building2 className="size-3.5 shrink-0 opacity-75" aria-hidden />
          Internal staff · dealership-authenticated
        </span>
      </div>
    </header>
  );
}
