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
import { cardPanelHeaderClassName } from "@/lib/ui/panel";
import type { AiCopilotView } from "@/types/ai-copilot";
import { Badge } from "@/components/ui/badge";
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
    <section className={cn("space-y-2.5", className)}>
      <h3 className="text-muted-foreground text-xs font-semibold tracking-tight">
        {title}
      </h3>
      {children}
    </section>
  );
}

function intentLevelBadgeClass(level: "high" | "medium" | "low"): string {
  if (level === "high") {
    return "border-emerald-300/80 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-50";
  }
  if (level === "medium") {
    return "border-amber-300/80 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-50";
  }
  return "border-slate-300/80 bg-slate-100 text-slate-800 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100";
}

function IntentLevelBadge({
  level,
  label,
}: {
  level: "high" | "medium" | "low";
  label: string;
}) {
  return (
    <Badge variant="outline" className={cn("text-[11px] font-semibold", intentLevelBadgeClass(level))}>
      {label}
    </Badge>
  );
}

function AppointmentReadinessCard({
  appointment,
}: {
  appointment: import("@/lib/opportunity/appointment-readiness").AppointmentReadiness;
}) {
  const tone =
    appointment.kind === "booked"
      ? "border-emerald-300/80 bg-emerald-50/80 dark:border-emerald-800 dark:bg-emerald-950/40"
      : appointment.kind === "proposed"
        ? "border-amber-300/80 bg-amber-50/80 dark:border-amber-800 dark:bg-amber-950/40"
        : appointment.kind === "interested"
          ? "border-blue-300/80 bg-blue-50/60 dark:border-blue-800 dark:bg-blue-950/35"
          : "border-border/80 bg-muted/30";

  return (
    <div className={cn("space-y-2 rounded-md border px-3 py-2.5", tone)}>
      <p className="text-foreground text-[15px] font-semibold tracking-tight">
        {appointment.headline}
      </p>
      <p className="text-muted-foreground text-[12px] leading-snug">
        {appointment.detail}
      </p>
      {appointment.promptMarkInPipeline ? (
        <p className="text-foreground/90 text-[11px] font-medium leading-snug">
          When it is on your calendar → Pipeline →{" "}
          <span className="font-semibold">Appointment</span> (Overview counts that,
          not this panel).
        </p>
      ) : null}
    </div>
  );
}

const insightCardClassName =
  "border-border/80 bg-muted/25 rounded-md border px-3 py-2.5 text-[13px] leading-relaxed";

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
        className="border-border/60 bg-card hover:bg-muted/40 flex w-11 shrink-0 flex-col items-center justify-center gap-2 border-l px-1 py-4 shadow-[inset_1px_0_0_rgba(15,23,42,0.04)] transition-colors"
        aria-label="Open AI Copilot"
      >
        <Sparkles className="text-primary size-4 shrink-0" strokeWidth={1.5} aria-hidden />
        <span className="text-muted-foreground text-[10px] font-semibold tracking-wide [writing-mode:vertical-rl]">
          Insights
        </span>
      </button>
    );
  }

  return (
    <aside
      className="border-border/60 bg-card text-card-foreground flex w-[min(100%,22rem)] shrink-0 flex-col border-l shadow-[-8px_0_32px_-12px_rgba(15,23,42,0.08)] dark:shadow-[-8px_0_36px_-12px_rgba(0,0,0,0.35)]"
      aria-label="Conversation insights"
    >
      <header
        className={cn(
          cardPanelHeaderClassName,
          "shrink-0 gap-2 px-4 py-3"
        )}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Sparkles className="text-primary size-4 shrink-0" strokeWidth={1.5} aria-hidden />
          <div className="min-w-0">
            <h2 className="text-foreground truncate text-sm font-semibold tracking-tight">
              Insights
            </h2>
            <p className="text-muted-foreground text-[11px] leading-snug">
              AI suggestions — review before you act
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="text-muted-foreground size-8 shrink-0"
          onClick={() => onOpenChange(false)}
          aria-label="Collapse insights panel"
        >
          <ChevronRight className="size-4" aria-hidden />
        </Button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
        <div className="space-y-6">
          <CopilotSection title="Routing & intent">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant="secondary" className="text-[11px] font-medium">
                {copilot.routingDepartmentLabel}
              </Badge>
              <IntentLevelBadge
                level={copilot.intentLevel}
                label={copilot.intentLevelLabel}
              />
              <Badge variant="outline" className="text-muted-foreground text-[11px] font-normal tabular-nums">
                Score {Math.round(copilot.opportunityScore)}
              </Badge>
            </div>
            <p className="text-muted-foreground text-[13px] leading-snug">
              {copilot.intentSummary}
            </p>
          </CopilotSection>

          <CopilotSection title="Summary">
            <p className="text-foreground text-[13px] leading-relaxed">{copilot.summary}</p>
          </CopilotSection>

          <CopilotSection title="Suggested next actions">
            <ul className="space-y-2">
              {copilot.nextActions.map((action) => (
                <li
                  key={action}
                  className="text-foreground flex gap-2.5 text-[13px] leading-snug before:bg-primary/70 before:mt-[0.45rem] before:size-1.5 before:shrink-0 before:rounded-full before:content-['']"
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
                    className="border-border/80 bg-background hover:border-primary/25 hover:bg-muted/50 focus-visible:ring-ring/50 w-full rounded-md border px-3 py-2.5 text-left text-[13px] leading-snug transition-colors focus-visible:ring-2 focus-visible:outline-none"
                  >
                    {reply}
                  </button>
                </li>
              ))}
            </ul>
          </CopilotSection>

          <CopilotSection title="Customer profile">
            <div className={insightCardClassName}>
              <p className="text-foreground font-medium">{copilot.customerProfile.displayName}</p>
              {copilot.customerProfile.email ? (
                <p className="text-muted-foreground mt-1">{copilot.customerProfile.email}</p>
              ) : null}
              {copilot.customerProfile.phoneE164 ? (
                <p className="text-muted-foreground">{copilot.customerProfile.phoneE164}</p>
              ) : null}
              {copilot.customerProfile.missingFields.length > 0 ? (
                <p className="mt-2 text-[12px] text-amber-800 dark:text-amber-100/90">
                  Still need: {copilot.customerProfile.missingFields.join(", ")}
                </p>
              ) : null}
              {copilot.customerProfile.notes ? (
                <p className="text-muted-foreground border-border/70 mt-2 border-t pt-2">
                  {copilot.customerProfile.notes}
                </p>
              ) : null}
            </div>
          </CopilotSection>

          <CopilotSection title="Likely objections">
            <ul className="flex flex-wrap gap-1.5">
              {copilot.likelyObjections.map((item) => (
                <li key={item}>
                  <Badge variant="outline" className="text-[11px] font-normal">
                    {item}
                  </Badge>
                </li>
              ))}
            </ul>
          </CopilotSection>

          <CopilotSection title="Visit / appointment">
            <AppointmentReadinessCard appointment={copilot.appointment} />
          </CopilotSection>

          <CopilotSection title="Recommended inventory">
            <ul className="space-y-1.5">
              {copilot.recommendedInventory.map((item) => (
                <li key={item} className="text-foreground text-[13px] leading-snug">
                  {item}
                </li>
              ))}
            </ul>
          </CopilotSection>
        </div>
      </div>

      <footer className="border-border shrink-0 space-y-2.5 border-t bg-muted/25 px-4 py-3.5">
        <p className="text-muted-foreground text-xs font-semibold tracking-tight">
          Quick actions
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-9 justify-start gap-1.5"
            onClick={() => insertDraft(copilot.primaryDraftReply)}
          >
            <MessageSquare className="size-3.5 shrink-0 opacity-70" aria-hidden />
            Generate reply
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-9 justify-start gap-1.5"
            onClick={() =>
              insertDraft(
                "I'd love to get you in for a visit. What day and time works best for a test drive or quick appointment?"
              )
            }
          >
            <Calendar className="size-3.5 shrink-0 opacity-70" aria-hidden />
            Book appointment
          </Button>
          <form action={formAction} className="contents">
            <input type="hidden" name="conversationId" value={conversationId} />
            <input type="hidden" name="intent" value="escalate" />
            <Button
              type="submit"
              size="sm"
              variant="outline"
              disabled={isPending}
              className="h-9 w-full justify-start gap-1.5"
            >
              <AlertTriangle className="size-3.5 shrink-0 opacity-70" aria-hidden />
              Escalate
            </Button>
          </form>
          {hasAssignee && isCurrentAssignee ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-9 justify-start gap-1.5"
              onClick={scrollToAssign}
            >
              <UserPlus className="size-3.5 shrink-0 opacity-70" aria-hidden />
              Assign owner
            </Button>
          ) : (
            <form action={formAction} className="contents">
              <input type="hidden" name="conversationId" value={conversationId} />
              <input type="hidden" name="intent" value="claim" />
              <Button
                type="submit"
                size="sm"
                variant="outline"
                disabled={isPending}
                className="h-9 w-full justify-start gap-1.5"
              >
                <UserPlus className="size-3.5 shrink-0 opacity-70" aria-hidden />
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
          <p className="text-muted-foreground text-[11px] leading-snug">
            Drafts are suggestions only — never sent automatically.
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
        <div className="border-border/60 bg-card w-11 shrink-0 border-l" aria-hidden />
      )}
    </div>
  );
}
