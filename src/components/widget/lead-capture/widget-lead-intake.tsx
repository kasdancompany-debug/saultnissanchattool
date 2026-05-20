"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";

import { LEAD_INTENT_CARDS } from "@/lib/widget/lead-capture/intent-cards";
import { teaserForIntent } from "@/lib/widget/launcher-teasers";
import type { WidgetLeadCapturePayload } from "@/lib/widget/lead-capture/types";
import { cn } from "@/lib/utils";

import { useLeadCaptureFlow } from "./use-lead-capture-flow";

const panelClass =
  "flex max-h-[min(560px,calc(100dvh-5.5rem))] w-[min(100vw-1.25rem,400px)] flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0a0f1a] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.65)]";

export function WidgetLeadIntake({
  brandTitle,
  onClose,
  onComplete,
  submitting,
  initialIntent,
  onInitialIntentConsumed,
}: {
  brandTitle: string;
  onClose: () => void;
  onComplete: (lead: WidgetLeadCapturePayload) => void;
  submitting: boolean;
  initialIntent?: import("@/lib/widget/lead-capture/types").LeadIntent | null;
  onInitialIntentConsumed?: () => void;
}) {
  const flow = useLeadCaptureFlow();
  const listRef = useRef<HTMLDivElement>(null);
  const completedRef = useRef(false);
  const [input, setInput] = useState("");

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [flow.transcript, flow.currentStep]);

  const initialIntentAppliedRef = useRef(false);
  const { intent: activeIntent, selectIntent } = flow;

  useEffect(() => {
    if (!initialIntent || activeIntent || initialIntentAppliedRef.current) {
      return;
    }
    const teaser = teaserForIntent(initialIntent);
    const card = LEAD_INTENT_CARDS.find((c) => c.intent === initialIntent);
    const title = teaser?.flowTitle ?? card?.title;
    if (title) {
      initialIntentAppliedRef.current = true;
      selectIntent(initialIntent, title);
      onInitialIntentConsumed?.();
    }
  }, [initialIntent, activeIntent, selectIntent, onInitialIntentConsumed]);

  useEffect(() => {
    if (flow.isComplete && !submitting && !completedRef.current) {
      const payload = flow.buildPayload();
      if (payload) {
        completedRef.current = true;
        onComplete(payload);
      }
    }
  }, [flow, flow.isComplete, flow.buildPayload, onComplete, submitting]);

  const showIntentCards = !flow.intent;
  const step = flow.currentStep;

  return (
    <div className={panelClass}>
      <header className="flex shrink-0 items-center justify-between border-b border-white/[0.08] px-5 py-4">
        <div>
          <p className="text-[15px] font-semibold tracking-tight text-white">{brandTitle}</p>
          <p className="mt-0.5 text-[12px] text-zinc-400">We&apos;re here to help</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-white/[0.06] hover:text-white"
          aria-label="Close"
        >
          ×
        </button>
      </header>

      <div
        ref={listRef}
        className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-5"
      >
        {flow.transcript.length === 0 ? (
          <AssistantBubble>
            Welcome to Sault Nissan 👋{"\n\n"}What can we help with today?
          </AssistantBubble>
        ) : (
          flow.transcript.map((line) =>
            line.role === "assistant" ? (
              <AssistantBubble key={line.id}>{line.body}</AssistantBubble>
            ) : (
              <CustomerBubble key={line.id}>{line.body}</CustomerBubble>
            )
          )
        )}

        {showIntentCards ? (
          <div className="mt-1 grid gap-2.5">
            {LEAD_INTENT_CARDS.map((card) => (
              <button
                key={card.intent}
                type="button"
                disabled={submitting}
                onClick={() => flow.selectIntent(card.intent, card.title)}
                className={cn(
                  "group flex w-full items-center gap-3 rounded-xl border border-white/[0.1] bg-white/[0.04] px-4 py-3.5 text-left",
                  "transition-all duration-200 hover:border-[#c8102e]/40 hover:bg-white/[0.08] hover:shadow-[0_0_0_1px_rgba(200,16,46,0.15)]",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c8102e]/50"
                )}
              >
                <span className="text-2xl" aria-hidden>
                  {card.emoji}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-semibold text-white">
                    {card.title}
                  </span>
                  <span className="mt-0.5 block text-[12px] text-zinc-400">
                    {card.subtitle}
                  </span>
                </span>
                <ArrowRight className="size-4 shrink-0 text-zinc-500 transition-transform group-hover:translate-x-0.5 group-hover:text-[#c8102e]" />
              </button>
            ))}
          </div>
        ) : null}

        {step && step.kind !== "assistant" && step.kind !== "intent_cards" ? (
          <StepInput
            step={step}
            input={input}
            setInput={setInput}
            disabled={submitting}
            onSubmit={(v, label) => {
              flow.submitAnswer(v, label);
              setInput("");
            }}
            onSkipEmail={flow.skipEmail}
          />
        ) : null}

        {submitting ? (
          <p className="flex items-center justify-center gap-2 py-4 text-[13px] text-zinc-400">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Creating your conversation…
          </p>
        ) : null}
      </div>
    </div>
  );
}

function AssistantBubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-[92%]">
      <div className="rounded-2xl rounded-tl-md border border-white/[0.08] bg-white/[0.07] px-4 py-3.5 text-[15px] leading-relaxed whitespace-pre-wrap text-zinc-100">
        {children}
      </div>
    </div>
  );
}

function CustomerBubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[88%] rounded-2xl rounded-tr-md bg-[#c8102e] px-4 py-3 text-[15px] leading-relaxed text-white shadow-lg shadow-[#c8102e]/20">
        {children}
      </div>
    </div>
  );
}

function StepInput({
  step,
  input,
  setInput,
  disabled,
  onSubmit,
  onSkipEmail,
}: {
  step: import("@/lib/widget/lead-capture/types").LeadFlowStep;
  input: string;
  setInput: (v: string) => void;
  disabled: boolean;
  onSubmit: (value: string, displayLabel?: string) => void;
  onSkipEmail: () => void;
}) {
  if (step.kind === "choice" && step.options) {
    return (
      <div className="flex flex-wrap gap-2">
        {step.options.map((opt) => (
          <button
            key={opt.id}
            type="button"
            disabled={disabled}
            onClick={() => onSubmit(opt.id, opt.label)}
            className={cn(
              "rounded-full border border-white/[0.12] bg-white/[0.05] px-4 py-2 text-[13px] font-medium text-white",
              "transition-colors hover:border-[#c8102e]/50 hover:bg-[#c8102e]/15"
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    );
  }

  const isPhone = step.kind === "phone";
  const isEmail = step.kind === "email_optional";

  return (
    <form
      className="mt-1 flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(input);
      }}
    >
      <div className="flex gap-2">
        <input
          type={isPhone ? "tel" : isEmail ? "email" : "text"}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={step.placeholder}
          disabled={disabled}
          autoFocus
          className="min-h-[48px] flex-1 rounded-xl border border-white/[0.12] bg-white/[0.06] px-4 text-[15px] text-white placeholder:text-zinc-500 focus:border-[#c8102e]/50 focus:outline-none focus:ring-2 focus:ring-[#c8102e]/30"
        />
        <button
          type="submit"
          disabled={disabled || !input.trim()}
          className="flex shrink-0 items-center justify-center rounded-xl bg-[#c8102e] px-4 text-white transition-colors hover:bg-[#a00d26] disabled:opacity-40"
        >
          <ArrowRight className="size-5" />
          <span className="sr-only">Continue</span>
        </button>
      </div>
      {isEmail ? (
        <button
          type="button"
          disabled={disabled}
          onClick={onSkipEmail}
          className="self-start text-[12px] font-medium text-zinc-400 underline-offset-2 hover:text-white hover:underline"
        >
          Skip email
        </button>
      ) : null}
    </form>
  );
}
