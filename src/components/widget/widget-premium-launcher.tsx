"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronDown, MessageCircle, Sparkles, X } from "lucide-react";

import { WIDGET_LAUNCHER_TEASERS } from "@/lib/widget/launcher-teasers";
import type { LeadIntent } from "@/lib/widget/lead-capture/types";
import { cn } from "@/lib/utils";

const ROTATE_MS = 3800;

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduced(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  return reduced;
}

function useIsMobileViewport(): boolean {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const apply = () => setMobile(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  return mobile;
}

export function WidgetPremiumLauncher({
  open,
  panelId,
  launcherId,
  launcherBtnRef,
  onToggle,
  onSelectIntent,
}: {
  open: boolean;
  panelId: string;
  launcherId: string;
  launcherBtnRef: React.RefObject<HTMLButtonElement | null>;
  onToggle: () => void;
  onSelectIntent: (intent: LeadIntent) => void;
}) {
  const reducedMotion = usePrefersReducedMotion();
  const isMobile = useIsMobileViewport();
  const [activeIndex, setActiveIndex] = useState(0);
  const [mobileExpanded, setMobileExpanded] = useState(false);
  const [teaserKey, setTeaserKey] = useState(0);

  const activeTeaser = WIDGET_LAUNCHER_TEASERS[activeIndex]!;

  useEffect(() => {
    if (open) {
      setMobileExpanded(false);
    }
  }, [open]);

  useEffect(() => {
    if (open || reducedMotion || isMobile) {
      return;
    }
    const id = window.setInterval(() => {
      setActiveIndex((i) => (i + 1) % WIDGET_LAUNCHER_TEASERS.length);
      setTeaserKey((k) => k + 1);
    }, ROTATE_MS);
    return () => window.clearInterval(id);
  }, [open, reducedMotion, isMobile]);

  const pickIntent = useCallback(
    (intent: LeadIntent) => {
      setMobileExpanded(false);
      onSelectIntent(intent);
    },
    [onSelectIntent]
  );

  if (open) {
    return (
      <button
        ref={launcherBtnRef}
        type="button"
        id={launcherId}
        onClick={onToggle}
        className={cn(
          "pointer-events-auto flex items-center justify-center rounded-full shadow-lg transition-[box-shadow,transform] duration-200 ease-out focus-visible:ring-4 focus-visible:ring-offset-2 focus-visible:outline-none touch-manipulation",
          "h-12 w-12 text-white ring-2 ring-white/25 sm:h-14 sm:w-14",
          "hover:shadow-xl active:scale-[0.98]"
        )}
        style={{ backgroundColor: "var(--widget-primary)" }}
        aria-expanded
        aria-controls={panelId}
        aria-haspopup="dialog"
      >
        <X className="size-6 sm:size-7" aria-hidden />
        <span className="sr-only">Close chat</span>
      </button>
    );
  }

  if (isMobile) {
    return (
      <div
        className={cn(
          "pointer-events-auto flex flex-col items-end gap-2 transition-[width] duration-300 ease-out",
          mobileExpanded ? "w-[min(100vw-1.5rem,20rem)]" : "w-auto"
        )}
      >
        {mobileExpanded ? (
          <div
            className="widget-launcher-mobile-expand w-full rounded-2xl border border-white/10 bg-[#0c1220]/95 p-2 shadow-[0_20px_48px_-12px_rgba(0,0,0,0.55)] backdrop-blur-xl"
            role="group"
            aria-label="Quick actions"
          >
            <div className="grid grid-cols-2 gap-1.5">
              {WIDGET_LAUNCHER_TEASERS.map((teaser) => (
                <button
                  key={teaser.id}
                  type="button"
                  onClick={() => pickIntent(teaser.intent)}
                  className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2.5 text-left text-[13px] font-medium text-white transition-colors hover:border-white/20 hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
                >
                  <span className="text-base" aria-hidden>
                    {teaser.emoji}
                  </span>
                  <span className="truncate">{teaser.shortLabel}</span>
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={onToggle}
              className="mt-1.5 flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: "var(--widget-primary)" }}
            >
              <MessageCircle className="size-4 opacity-90" aria-hidden />
              Message us
            </button>
          </div>
        ) : null}

        <button
          ref={launcherBtnRef}
          type="button"
          id={launcherId}
          onClick={() => setMobileExpanded((expanded) => !expanded)}
          className={cn(
            "widget-launcher-pill flex h-11 max-w-[min(100vw-1.5rem,18rem)] items-center gap-2 rounded-full border border-white/12 bg-[#0c1220]/92 px-3.5 shadow-[0_12px_32px_-8px_rgba(0,0,0,0.5)] backdrop-blur-xl transition-[box-shadow,transform] duration-300 ease-out",
            "focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:outline-none touch-manipulation",
            "active:scale-[0.99]"
          )}
          aria-expanded={mobileExpanded}
          aria-controls={panelId}
          aria-haspopup="dialog"
        >
          <span
            className="flex size-8 shrink-0 items-center justify-center rounded-full text-white"
            style={{ backgroundColor: "var(--widget-primary)" }}
          >
            <Sparkles className="size-3.5" strokeWidth={2} aria-hidden />
          </span>
          <span className="min-w-0 flex-1 truncate text-left text-[13px] font-semibold text-white">
            <span key={reducedMotion ? "static" : activeTeaser.id} className="widget-teaser-text">
              {activeTeaser.emoji} {activeTeaser.shortLabel}
            </span>
          </span>
          <ChevronDown
            className={cn(
              "size-4 shrink-0 text-zinc-400 transition-transform duration-300",
              mobileExpanded && "rotate-180"
            )}
            aria-hidden
          />
          <span className="sr-only">
            {mobileExpanded ? "Collapse chat options" : "Expand chat options"}
          </span>
        </button>
      </div>
    );
  }

  return (
    <div className="pointer-events-auto flex flex-col items-end gap-3">
      <button
        type="button"
        onClick={() => pickIntent(activeTeaser.intent)}
        className={cn(
          "group relative w-[min(100vw-1.5rem,17.5rem)] overflow-hidden rounded-2xl border border-white/10 text-left",
          "bg-gradient-to-br from-[#121a2e] via-[#0e1526] to-[#0a0f1a]",
          "shadow-[0_16px_40px_-12px_rgba(0,0,0,0.55)] backdrop-blur-md",
          "transition-[border-color,box-shadow,transform] duration-300 ease-out",
          "hover:border-white/18 hover:shadow-[0_20px_48px_-10px_rgba(0,0,0,0.6)] hover:-translate-y-0.5",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/25"
        )}
        aria-label={`${activeTeaser.label} — start chat`}
      >
        <span
          className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.04] to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100"
          aria-hidden
        />
        <span
          key={reducedMotion ? activeTeaser.id : teaserKey}
          className={cn(
            "widget-teaser-card flex items-center gap-3 px-4 py-3.5",
            !reducedMotion && "widget-teaser-card-enter"
          )}
        >
          <span className="text-xl" aria-hidden>
            {activeTeaser.emoji}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[14px] font-semibold tracking-tight text-white">
              {activeTeaser.label}
            </span>
            <span className="mt-0.5 block text-[11px] text-zinc-400">
              Tap to start — takes under a minute
            </span>
          </span>
          <span
            className="text-[10px] font-medium tracking-wide text-zinc-500 uppercase"
            aria-hidden
          >
            {activeIndex + 1}/{WIDGET_LAUNCHER_TEASERS.length}
          </span>
        </span>
        <span className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-transparent via-[var(--widget-primary)] to-transparent opacity-60" />
      </button>

      <div className="flex items-center gap-1.5 pr-0.5" aria-hidden>
        {WIDGET_LAUNCHER_TEASERS.map((teaser, i) => (
          <span
            key={teaser.id}
            className={cn(
              "h-1 rounded-full transition-all duration-500",
              i === activeIndex
                ? "w-5 bg-white/70"
                : "w-1 bg-white/25"
            )}
          />
        ))}
      </div>

      <button
        ref={launcherBtnRef}
        type="button"
        id={launcherId}
        onClick={onToggle}
        className={cn(
          "flex h-14 w-14 items-center justify-center rounded-full text-white shadow-lg transition-[box-shadow,transform] duration-200 ease-out",
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
    </div>
  );
}
