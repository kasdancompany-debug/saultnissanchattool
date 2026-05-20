"use client";

import type { ConversationStatus } from "@/integrations/supabase/database.types";
import { resolveConversationHandlingMode } from "@/lib/conversation/control-metadata";
import { cn } from "@/lib/utils";

export function InboxAiHumanBanner({
  status,
  metadata,
  assigneeDisplay,
}: {
  status: ConversationStatus;
  metadata: unknown;
  assigneeDisplay: string | null;
}) {
  const mode = resolveConversationHandlingMode(metadata, status);

  if (mode === "claimed_by_staff") {
    return (
      <div
        className={cn(
          "mx-6 mt-3 rounded-lg bg-emerald-500/12 px-4 py-3 text-sm text-emerald-950 shadow-[0_2px_12px_-4px_rgba(16,185,129,0.2)]",
          "dark:bg-emerald-500/18 dark:text-emerald-50 dark:shadow-[0_2px_14px_-4px_rgba(16,185,129,0.25)]"
        )}
      >
        <p className="text-[13px] font-bold tracking-tight">Human control</p>
        <p className="mt-1 text-[13px] leading-relaxed text-emerald-950/85 dark:text-emerald-50/90">
          AI is assist-only (drafts and routing hints). Customer-facing messages are sent by staff.
          {assigneeDisplay ? (
            <>
              {" "}
              <span className="font-medium text-emerald-950 dark:text-emerald-50">
                Owner: {assigneeDisplay}
              </span>
            </>
          ) : null}
        </p>
      </div>
    );
  }

  if (mode === "waiting_for_human") {
    return (
      <div className="mx-6 mt-3 rounded-lg bg-amber-500/12 px-4 py-3 text-sm text-amber-950 shadow-[0_2px_12px_-4px_rgba(245,158,11,0.22)] dark:bg-amber-950/40 dark:text-amber-50 dark:shadow-[0_2px_14px_-4px_rgba(245,158,11,0.2)]">
        <p className="text-[13px] font-bold tracking-tight">Waiting for a teammate</p>
        <p className="mt-1 text-[13px] leading-relaxed opacity-90">
          This thread is queued for human follow-up. Claim it when you are ready to own the
          conversation.
        </p>
      </div>
    );
  }

  return (
    <div className="text-muted-foreground mx-6 mt-3 rounded-lg bg-muted/35 px-4 py-2.5 text-[12px] font-normal leading-snug shadow-[0_1px_4px_rgba(15,23,42,0.05)]">
      <span className="text-foreground font-bold">AI triage</span> can classify inbound messages
      and suggest safe replies. Claim or send a reply to move the thread to human control. Automated
      text never negotiates pricing, payments, approvals, or trade values.
    </div>
  );
}
