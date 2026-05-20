"use client";

import { startTransition, useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Calendar,
  ChevronRight,
  MessageSquare,
  Sparkles,
  UserPlus,
  AlertTriangle,
} from "lucide-react";

import { inboxConversationAction } from "@/app/(dashboard)/inbox/conversation-actions";
import {
  inboxConversationInitialState,
  type InboxConversationActionState,
} from "@/app/(dashboard)/inbox/conversation-action-states";
import { dispatchInboxInsertDraft } from "@/lib/inbox/inbox-draft";
import { markInboxClientRefreshed } from "@/lib/inbox-client-refresh-coord";
import type { AiCopilotView } from "@/types/ai-copilot";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "inbox-ai-copilot-open";

function readStoredOpen(): boolean {
  if (typeof window === "undefined") {
    return true;
  }
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "0") return false;
    if (v === "1") return true;
  } catch {
    /* ignore */
  }
  return true;
}

function CopilotSection({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("space-y-2", className)}>
      <h3 className="text-[11px] font-semibold tracking-[0.12em] text-zinc-500 uppercase dark:text-zinc-400">
        {title}
      </h3>
      {children}
    </section>
  );
}

function IntentLevelBadge({
  level,
  label,
}: {
  level: "high" | "medium" | "low";
  label: string;
}) {
  const styles =
    level === "high"
      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
      : level === "medium"
        ? "border-amber-500/35 bg-amber-500/10 text-amber-200"
        : "border-zinc-600 bg-zinc-800/60 text-zinc-400";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-tight",
        styles
      )}
    >
      {label}
    </span>
  );
}

function ProbabilityMeter({ value }: { value: number }) {
  const pct = Math.round(Math.max(0, Math.min(100, value)));
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-2xl font-semibold tracking-tight text-zinc-100 tabular-nums">
          {pct}%
        </span>
        <span className="text-xs text-zinc-500">appointment likelihood</span>
      </div>
      <div
        className="h-1.5 overflow-hidden rounded-full bg-zinc-800/80"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-emerald-400 transition-[width] duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function InboxAiCopilotDrawer({
  conversationId,
  copilot,
  hasAssignee,
  isCurrentAssignee,
  open,
  onOpenChange,
}: {
  conversationId: string;
  copilot: AiCopilotView;
  hasAssignee: boolean;
  isCurrentAssignee: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [actionState, formAction, isPending] = useActionState<
    InboxConversationActionState,
    FormData
  >(inboxConversationAction, inboxConversationInitialState);

  useEffect(() => {
    if (actionState.ok) {
      startTransition(() => {
        router.refresh();
        markInboxClientRefreshed();
      });
    }
  }, [actionState, router]);

  const insertDraft = (text: string) => {
    dispatchInboxInsertDraft(text);
    document.getElementById("inbox-reply-form")?.scrollIntoView({ behavior: "smooth" });
  };

  const scrollToAssign = () => {
    document.getElementById("inbox-thread-toolbar")?.scrollIntoView({ behavior: "smooth" });
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => onOpenChange(true)}
        className="border-border/60 bg-background/95 hover:bg-muted/40 flex w-11 shrink-0 flex-col items-center justify-center gap-2 border-l px-1 py-4 shadow-sm backdrop-blur-sm transition-colors"
        aria-label="Open AI Copilot"
      >
        <Sparkles className="text-primary size-4 shrink-0" strokeWidth={1.5} aria-hidden />
        <span className="text-muted-foreground text-[10px] font-semibold tracking-wider [writing-mode:vertical-rl]">
          AI Copilot
        </span>
      </button>
    );
  }

  return (
    <aside
      className="border-border/60 bg-zinc-950 text-zinc-100 flex w-[min(100%,22rem)] shrink-0 flex-col border-l shadow-[-12px_0_40px_-16px_rgba(0,0,0,0.45)]"
      aria-label="AI Copilot"
    >
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-zinc-800/80 px-4 py-3.5">
        <div className="flex min-w-0 items-center gap-2">
          <Sparkles className="size-4 shrink-0 text-emerald-400" strokeWidth={1.5} aria-hidden />
          <h2 className="truncate text-sm font-semibold tracking-tight">AI Copilot</h2>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 shrink-0 text-zinc-400 hover:bg-zinc-800/80 hover:text-zinc-100"
          onClick={() => onOpenChange(false)}
          aria-label="Collapse AI Copilot"
        >
          <ChevronRight className="size-4" aria-hidden />
        </Button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
        <div className="space-y-6">
          <CopilotSection title="Routing & intent">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-zinc-700/80 bg-zinc-900/80 px-2.5 py-1 text-[11px] font-medium text-zinc-200">
                {copilot.routingDepartmentLabel}
              </span>
              <IntentLevelBadge
                level={copilot.intentLevel}
                label={copilot.intentLevelLabel}
              />
              <span className="text-[11px] text-zinc-500 tabular-nums">
                Score {Math.round(copilot.opportunityScore)}
              </span>
            </div>
            <p className="mt-2 text-[13px] leading-snug text-zinc-400">{copilot.intentSummary}</p>
          </CopilotSection>

          <CopilotSection title="Summary">
            <p className="text-[13px] leading-relaxed text-zinc-300">{copilot.summary}</p>
          </CopilotSection>

          <CopilotSection title="Suggested next actions">
            <ul className="space-y-2">
              {copilot.nextActions.map((action) => (
                <li
                  key={action}
                  className="flex gap-2 text-[13px] leading-snug text-zinc-300 before:mt-2 before:size-1 before:shrink-0 before:rounded-full before:bg-emerald-500/80 before:content-['']"
                >
                  {action}
                </li>
              ))}
            </ul>
          </CopilotSection>

          <CopilotSection title="Suggested responses">
            <ul className="space-y-2">
              {copilot.suggestedResponses.map((reply) => (
                <li key={reply}>
                  <button
                    type="button"
                    onClick={() => insertDraft(reply)}
                    className="w-full rounded-lg border border-zinc-800/90 bg-zinc-900/60 px-3 py-2.5 text-left text-[13px] leading-snug text-zinc-200 transition-colors hover:border-zinc-700 hover:bg-zinc-900"
                  >
                    {reply}
                  </button>
                </li>
              ))}
            </ul>
          </CopilotSection>

          <CopilotSection title="Customer profile">
            <div className="rounded-lg border border-zinc-800/90 bg-zinc-900/50 px-3 py-2.5 text-[13px]">
              <p className="font-medium text-zinc-100">{copilot.customerProfile.displayName}</p>
              {copilot.customerProfile.email ? (
                <p className="mt-1 text-zinc-400">{copilot.customerProfile.email}</p>
              ) : null}
              {copilot.customerProfile.phoneE164 ? (
                <p className="text-zinc-400">{copilot.customerProfile.phoneE164}</p>
              ) : null}
              {copilot.customerProfile.missingFields.length > 0 ? (
                <p className="mt-2 text-[12px] text-amber-200/90">
                  Still need: {copilot.customerProfile.missingFields.join(", ")}
                </p>
              ) : null}
              {copilot.customerProfile.notes ? (
                <p className="mt-2 border-t border-zinc-800/80 pt-2 text-zinc-400">
                  {copilot.customerProfile.notes}
                </p>
              ) : null}
            </div>
          </CopilotSection>

          <CopilotSection title="Likely objections">
            <ul className="flex flex-wrap gap-1.5">
              {copilot.likelyObjections.map((item) => (
                <li
                  key={item}
                  className="rounded-full border border-zinc-700/80 bg-zinc-900/80 px-2.5 py-1 text-[11px] text-zinc-300"
                >
                  {item}
                </li>
              ))}
            </ul>
          </CopilotSection>

          <CopilotSection title="Appointment probability">
            <ProbabilityMeter value={copilot.appointmentProbability} />
          </CopilotSection>

          <CopilotSection title="Recommended inventory">
            <ul className="space-y-1.5">
              {copilot.recommendedInventory.map((item) => (
                <li key={item} className="text-[13px] leading-snug text-zinc-300">
                  {item}
                </li>
              ))}
            </ul>
          </CopilotSection>
        </div>
      </div>

      <footer className="shrink-0 space-y-2 border-t border-zinc-800/80 px-4 py-3.5">
        <p className="text-[10px] font-semibold tracking-[0.12em] text-zinc-500 uppercase">
          Quick actions
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="h-9 justify-start gap-1.5 border-zinc-700/60 bg-zinc-900 text-zinc-100 hover:bg-zinc-800"
            onClick={() => insertDraft(copilot.primaryDraftReply)}
          >
            <MessageSquare className="size-3.5 shrink-0 opacity-80" aria-hidden />
            Generate reply
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="h-9 justify-start gap-1.5 border-zinc-700/60 bg-zinc-900 text-zinc-100 hover:bg-zinc-800"
            onClick={() =>
              insertDraft(
                "I'd love to get you in for a visit. What day and time works best for a test drive or quick appointment?"
              )
            }
          >
            <Calendar className="size-3.5 shrink-0 opacity-80" aria-hidden />
            Book appointment
          </Button>
          <form action={formAction} className="contents">
            <input type="hidden" name="conversationId" value={conversationId} />
            <input type="hidden" name="intent" value="escalate" />
            <Button
              type="submit"
              size="sm"
              variant="secondary"
              disabled={isPending}
              className="h-9 w-full justify-start gap-1.5 border-zinc-700/60 bg-zinc-900 text-zinc-100 hover:bg-zinc-800"
            >
              <AlertTriangle className="size-3.5 shrink-0 opacity-80" aria-hidden />
              Escalate
            </Button>
          </form>
          {hasAssignee && isCurrentAssignee ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="h-9 justify-start gap-1.5 border-zinc-700/60 bg-zinc-900 text-zinc-100 hover:bg-zinc-800"
              onClick={scrollToAssign}
            >
              <UserPlus className="size-3.5 shrink-0 opacity-80" aria-hidden />
              Assign owner
            </Button>
          ) : (
            <form action={formAction} className="contents">
              <input type="hidden" name="conversationId" value={conversationId} />
              <input type="hidden" name="intent" value="claim" />
              <Button
                type="submit"
                size="sm"
                variant="secondary"
                disabled={isPending}
                className="h-9 w-full justify-start gap-1.5 border-zinc-700/60 bg-zinc-900 text-zinc-100 hover:bg-zinc-800"
              >
                <UserPlus className="size-3.5 shrink-0 opacity-80" aria-hidden />
                Assign owner
              </Button>
            </form>
          )}
        </div>
        {actionState.error ? (
          <p className="text-destructive text-xs" role="alert">
            {actionState.error}
          </p>
        ) : null}
        {copilot.classification ? (
          <p className="text-[10px] leading-snug text-zinc-600">
            AI assist · review before sending · never auto-sent
          </p>
        ) : null}
      </footer>
    </aside>
  );
}

export function InboxAiCopilotShell({
  conversationId,
  copilot,
  hasAssignee,
  isCurrentAssignee,
  children,
}: {
  conversationId: string;
  copilot: AiCopilotView;
  hasAssignee: boolean;
  isCurrentAssignee: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setOpen(readStoredOpen());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, open ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [open, hydrated]);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{children}</div>
      {hydrated ? (
        <InboxAiCopilotDrawer
          conversationId={conversationId}
          copilot={copilot}
          hasAssignee={hasAssignee}
          isCurrentAssignee={isCurrentAssignee}
          open={open}
          onOpenChange={setOpen}
        />
      ) : (
        <div className="border-border/60 w-11 shrink-0 border-l" aria-hidden />
      )}
    </div>
  );
}
