"use client";

import { useState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";

import { LEAD_INTENT_CARDS } from "@/lib/widget/lead-capture/intent-cards";
import type { LeadIntent } from "@/lib/widget/lead-capture/types";
import { cn } from "@/lib/utils";

function panelClassName(presentation: "embed" | "page"): string {
  const size =
    presentation === "page"
      ? "max-h-[min(92dvh,720px)] w-full max-w-[420px]"
      : "max-h-[min(640px,calc(100dvh-4rem))] w-[min(100vw-1.25rem,400px)]";
  return cn(
    "pointer-events-auto relative z-20 flex flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0a0f1a] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.65)]",
    size
  );
}

export function WidgetLeadIntake({
  brandTitle,
  onClose,
  onBeginChat,
  onContinueChat,
  canContinueChat,
  starting,
  presentation = "embed",
  error,
  buildLabel,
}: {
  brandTitle: string;
  onClose: () => void;
  onBeginChat: (intent: LeadIntent, cardTitle: string, initialText?: string) => void;
  onContinueChat?: () => void;
  canContinueChat?: boolean;
  starting: boolean;
  presentation?: "embed" | "page";
  error?: string | null;
  buildLabel?: string | null;
}) {
  const [menuDraft, setMenuDraft] = useState("");

  const begin = (intent: LeadIntent, title: string, text?: string) => {
    if (starting) return;
    onBeginChat(intent, title, text);
  };

  return (
    <div className={panelClassName(presentation)}>
      <header className="flex shrink-0 items-center justify-between border-b border-white/[0.08] px-5 py-4">
        <div>
          <p className="text-[15px] font-semibold tracking-tight text-white">{brandTitle}</p>
          <p className="mt-0.5 text-[12px] text-zinc-400">
            Chat with our AI assistant — ask anything below
          </p>
        </div>
        {presentation === "embed" ? (
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-white/[0.06] hover:text-white"
            aria-label="Close"
          >
            ×
          </button>
        ) : null}
      </header>

      {error ? (
        <div
          className="mx-5 mt-4 shrink-0 rounded-lg border border-rose-500/35 bg-rose-950/50 px-3 py-2.5 text-[13px] leading-snug text-rose-100"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      {starting ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-5 py-10">
          <Loader2 className="size-6 animate-spin text-zinc-400" aria-hidden />
          <p className="text-[13px] text-zinc-400">Starting your chat…</p>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <p className="px-5 pt-3 text-[11px] leading-relaxed text-zinc-500">
            What do you need help with? Pick a topic below or type your question.
          </p>
          {canContinueChat && onContinueChat ? (
            <div className="px-4 pb-1">
              <button
                type="button"
                onClick={onContinueChat}
                disabled={starting}
                className="w-full rounded-xl border border-white/[0.14] bg-white/[0.06] px-3 py-2.5 text-[13px] font-medium text-zinc-200 transition-colors hover:bg-white/[0.1] disabled:opacity-50"
              >
                Continue previous chat
              </button>
            </div>
          ) : null}
          <div className="widget-no-scrollbar grid flex-1 grid-cols-1 gap-1.5 overflow-hidden px-4 py-2">
            {LEAD_INTENT_CARDS.map((card) => (
              <button
                key={card.intent}
                type="button"
                disabled={starting}
                onClick={() => begin(card.intent, card.title)}
                className={cn(
                  "group flex w-full items-center gap-2.5 rounded-xl border border-white/[0.1] bg-white/[0.04] px-3 py-2.5 text-left",
                  "transition-all duration-200 hover:border-[#c8102e]/40 hover:bg-white/[0.08]",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c8102e]/50"
                )}
              >
                <span className="shrink-0 text-xl" aria-hidden>
                  {card.emoji}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-semibold text-white">{card.title}</span>
                  <span className="mt-0.5 block text-[11px] leading-snug text-zinc-400">
                    {card.subtitle}
                  </span>
                </span>
                <ArrowRight className="size-3.5 shrink-0 text-zinc-500 group-hover:text-[#c8102e]" />
              </button>
            ))}
          </div>
          <footer className="shrink-0 border-t border-white/[0.08] bg-[#070b14] p-4">
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const text = menuDraft.trim();
                if (!text) return;
                begin("general", "General question", text);
                setMenuDraft("");
              }}
            >
              <input
                type="text"
                value={menuDraft}
                onChange={(e) => setMenuDraft(e.target.value)}
                placeholder="Type your question…"
                disabled={starting}
                autoFocus
                className="min-h-[44px] flex-1 rounded-xl border border-white/[0.12] bg-white/[0.06] px-4 text-[15px] text-white placeholder:text-zinc-500 focus:border-[#c8102e]/50 focus:outline-none focus:ring-2 focus:ring-[#c8102e]/30"
                aria-label="Your message"
              />
              <button
                type="submit"
                disabled={starting || !menuDraft.trim()}
                className="flex shrink-0 items-center justify-center rounded-xl bg-[#c8102e] px-4 text-white transition-colors hover:bg-[#a00d26] disabled:opacity-40"
              >
                <ArrowRight className="size-5" aria-hidden />
                <span className="sr-only">Send</span>
              </button>
            </form>
            {buildLabel ? (
              <p className="mt-2 text-center text-[9px] text-zinc-600">Build {buildLabel}</p>
            ) : null}
          </footer>
        </div>
      )}
    </div>
  );
}
