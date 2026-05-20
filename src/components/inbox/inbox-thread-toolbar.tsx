"use client";

import { startTransition, useActionState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";

import { markInboxClientRefreshed } from "@/lib/inbox-client-refresh-coord";

import type { ConversationStatus } from "@/integrations/supabase/database.types";
import type { StaffDepartment } from "@/integrations/supabase/database.types";
import {
  inboxConversationAction,
} from "@/app/(dashboard)/inbox/conversation-actions";
import {
  inboxConversationInitialState,
  type InboxConversationActionState,
} from "@/app/(dashboard)/inbox/conversation-action-states";

import { Separator } from "@/components/ui/separator";
import { SubmitButton } from "@/components/ui/submit-button";
import {
  cardPanelBodyClassName,
  cardPanelClassName,
  cardPanelHeaderClassName,
} from "@/lib/ui/panel";
import { cn } from "@/lib/utils";

export type StaffPickerOption = {
  id: string;
  display_name: string;
};

export function InboxThreadToolbar({
  id,
  conversationId,
  status,
  department,
  assignee,
  workflowCaption,
  currentStaffUserId,
  canManageAssignments,
  staffDirectory,
}: {
  id?: string;
  conversationId: string;
  status: ConversationStatus;
  department: StaffDepartment;
  assignee: { id: string; display_name: string } | null;
  workflowCaption: string;
  currentStaffUserId: string;
  canManageAssignments: boolean;
  staffDirectory: StaffPickerOption[];
}) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState<
    InboxConversationActionState,
    FormData
  >(inboxConversationAction, inboxConversationInitialState);

  useEffect(() => {
    if (state.ok) {
      startTransition(() => {
        router.refresh();
        markInboxClientRefreshed();
      });
    }
  }, [state, router]);

  const terminal = status === "closed" || status === "archived" || status === "spam";

  const showClaim =
    !terminal &&
    (!assignee ||
      assignee.id !== currentStaffUserId ||
      status === "waiting_for_human");

  const claimLabel = useMemo(() => {
    if (!assignee || assignee.id === currentStaffUserId) {
      return status === "waiting_for_human"
        ? "Resume as owner"
        : "Claim this customer";
    }
    return `Take ownership from ${assignee.display_name}`;
  }, [assignee, currentStaffUserId, status]);

  const reassignCandidates = useMemo(
    () =>
      assignee
        ? staffDirectory.filter((s) => s.id !== assignee.id)
        : staffDirectory,
    [staffDirectory, assignee]
  );

  const showReassign =
    !terminal &&
    canManageAssignments &&
    Boolean(assignee) &&
    reassignCandidates.length > 0;
  const showUnassign = !terminal && canManageAssignments && Boolean(assignee);

  const showMarkPending = !terminal && status !== "pending";
  const showDeptButtons = !terminal;

  const showClose = !terminal;

  /** Takeover path only when another teammate is the primary owner (server enforces CAS without this). */
  const takeover =
    assignee != null && assignee.id !== currentStaffUserId ? "1" : "0";

  return (
    <div
      id={id}
      className="from-muted/25 shrink-0 bg-gradient-to-b to-transparent px-4 py-3 sm:px-5"
    >
      <div className={cn(cardPanelClassName, "mb-3")}>
        <div className={cardPanelHeaderClassName}>
          <p className="text-muted-foreground/58 text-[9px] font-semibold tracking-[0.12em] uppercase">
            Primary owner
          </p>
        </div>
        <div className={cn(cardPanelBodyClassName, "space-y-1.5")}>
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            {assignee ? (
              <p className="text-foreground text-[1.1875rem] font-bold tracking-[-0.02em] sm:text-[1.3125rem]">
                {assignee.display_name}
                {assignee.id === currentStaffUserId ? (
                  <span className="text-muted-foreground/75 ml-1.5 text-[12px] font-normal">
                    (you)
                  </span>
                ) : null}
              </p>
            ) : (
              <p className="text-muted-foreground/85 text-[12px] font-semibold">
                Unassigned - no single owner yet
              </p>
            )}
          </div>
          <p className="text-muted-foreground/65 text-[10px] font-normal leading-relaxed">
            {workflowCaption}
          </p>
        </div>
      </div>

      {state.error ? (
        <p
          className="text-destructive bg-destructive/5 mb-3 rounded-lg border border-destructive/20 px-3 py-2 text-sm"
          role="alert"
        >
          {state.error}
        </p>
      ) : null}

      {terminal ? (
        <p className="text-muted-foreground text-sm">
          This conversation is read-only. Ownership and status cannot be changed here.
        </p>
      ) : (
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="conversationId" value={conversationId} />
          <input type="hidden" name="takeover" value={takeover} />

          <div className="flex flex-col gap-2">
            <p className="text-muted-foreground text-xs font-medium">
              Assignment
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {showClaim ? (
                <SubmitButton
                  type="submit"
                  name="intent"
                  value="claim"
                  size="sm"
                  variant="default"
                  className="min-w-[9rem]"
                >
                  {claimLabel}
                </SubmitButton>
              ) : null}

              {showReassign ? (
                <>
                  <Separator orientation="vertical" className="hidden h-7 sm:block" />
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="text-muted-foreground sr-only" htmlFor="reassign-select">
                      Reassign primary owner to
                    </label>
                    <select
                      id="reassign-select"
                      name="assignToUserId"
                      defaultValue=""
                      disabled={isPending}
                      className="border-input bg-background h-9 min-w-[13rem] rounded-lg border px-2.5 text-sm shadow-xs outline-none transition-[color,box-shadow,border-color,background-color] duration-150 ease-out focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/55 focus-visible:ring-offset-0 motion-reduce:transition-none disabled:opacity-50"
                    >
                      <option value="" disabled>
                        Choose teammate…
                      </option>
                      {reassignCandidates.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.display_name}
                          {s.id === currentStaffUserId ? " (you)" : ""}
                        </option>
                      ))}
                    </select>
                    <SubmitButton
                      type="submit"
                      name="intent"
                      value="reassign"
                      size="sm"
                      variant="outline"
                    >
                      Reassign customer
                    </SubmitButton>
                  </div>
                </>
              ) : null}

              {showUnassign ? (
                <>
                  <Separator orientation="vertical" className="hidden h-7 sm:block" />
                  <SubmitButton
                    type="submit"
                    name="intent"
                    value="unassign"
                    size="sm"
                    variant="outline"
                    title="Move this customer back to the unassigned queue."
                  >
                    Move to unassigned
                  </SubmitButton>
                </>
              ) : null}

              {!showClaim && !showReassign && !showUnassign ? (
                <p className="text-muted-foreground text-xs">
                  You own this thread. Use status tools below, or ask a manager/admin to reassign
                  ownership when handoff is needed.
                </p>
              ) : null}
            </div>
          </div>

          <Separator />

          <div className="flex flex-col gap-2">
            <p className="text-muted-foreground text-xs font-medium">
              Department
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {showDeptButtons ? (
                <>
                  <SubmitButton
                    type="submit"
                    name="intent"
                    value="mark_department_sales"
                    size="sm"
                    variant={department === "sales" ? "default" : "outline"}
                    title="Route this conversation to Sales."
                  >
                    Sales
                  </SubmitButton>
                  <SubmitButton
                    type="submit"
                    name="intent"
                    value="mark_department_service"
                    size="sm"
                    variant={department === "service" ? "default" : "outline"}
                    title="Route this conversation to Service."
                  >
                    Service
                  </SubmitButton>
                  <SubmitButton
                    type="submit"
                    name="intent"
                    value="mark_department_general"
                    size="sm"
                    variant={department === "general" ? "secondary" : "outline"}
                    title="Route this conversation to General."
                  >
                    General
                  </SubmitButton>
                </>
              ) : null}
            </div>
          </div>

          <Separator />

          <div className="flex flex-col gap-2">
            <p className="text-muted-foreground text-xs font-medium">
              Status
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {showMarkPending ? (
                <SubmitButton
                  type="submit"
                  name="intent"
                  value="mark_pending"
                  size="sm"
                  variant="secondary"
                  title="Marks the thread as waiting on a follow-up (internal queue)."
                >
                  Mark pending
                </SubmitButton>
              ) : null}
              {showClose ? (
                <SubmitButton
                  type="submit"
                  name="intent"
                  value="close"
                  size="sm"
                  variant="destructive"
                  title="Removes this thread from your active inbox (marked closed). Staff cannot send new replies."
                >
                  Delete conversation
                </SubmitButton>
              ) : null}
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
