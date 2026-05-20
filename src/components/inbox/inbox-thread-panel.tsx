import type {
  ConversationChannel,
  ConversationStatus,
  StaffDepartment,
} from "@/integrations/supabase/database.types";
import type { InboxMessageView } from "@/server/data/inbox";
import { isAfterHoursWebChatIntake } from "@/lib/conversation/widget-metadata";
import { isSentimentEscalationActive } from "@/lib/conversation/sentiment-escalation-metadata";

import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import { ConversationStatusBadge } from "./conversation-status-badge";
import { customerInitials } from "./inbox-customer-initials";
import { resolveInboxChannelSurface } from "@/lib/conversation/inbox-channel-surface";
import { inboxChannelSurfaceTagline } from "@/lib/conversation/inbox-channel-ux";
import { formatDepartmentLabel } from "./inbox-labels";
import {
  ConversationChannelAvatarChip,
  ConversationChannelBadge,
} from "./conversation-channel-badge";
import { InboxComposer } from "./inbox-composer";
import { InboxThreadMessages } from "./inbox-thread-messages";
import type { StaffPickerOption } from "./inbox-thread-toolbar";
import { InboxThreadToolbar } from "./inbox-thread-toolbar";
import { InboxAiHumanBanner } from "./inbox-ai-human-banner";
import { InboxConversationControlToggle } from "./inbox-conversation-control-toggle";
import { ConversationIntelligenceTags } from "./conversation-intelligence-tags";
import { InboxCustomerProfileForm } from "./inbox-customer-profile-form";

const NO_REPLY: ConversationStatus[] = ["closed", "archived", "spam"];

function canStaffReply(status: ConversationStatus): boolean {
  return !NO_REPLY.includes(status);
}

function getLatestMessageBody(messages: InboxMessageView[]): string {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const msg = messages[i];
    const body = msg?.body?.trim();
    if (msg?.sender_type === "customer" && body) {
      return body;
    }
  }

  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const body = messages[i]?.body?.trim();
    if (body) {
      return body;
    }
  }
  return "";
}

function departmentBadgeClass(department: StaffDepartment): string {
  if (department === "sales") {
    return "border-rose-300/80 bg-rose-50 text-rose-900 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-100";
  }
  if (department === "service") {
    return "border-violet-300/80 bg-violet-50 text-violet-900 dark:border-violet-800 dark:bg-violet-950/50 dark:text-violet-100";
  }
  return "border-slate-300/80 bg-slate-100 text-slate-900 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-100";
}

export function InboxThreadPanel({
  conversationId,
  customerDisplayName,
  conversationTitle,
  channel,
  department,
  status,
  messages,
  assignee,
  workflowCaption,
  currentStaffUserId,
  canManageAssignments,
  staffDirectory,
  conversationMetadata,
  aiEnabled,
  customerEmail,
  customerPhoneE164,
}: {
  conversationId: string;
  customerDisplayName: string;
  conversationTitle: string | null;
  channel: ConversationChannel;
  department: StaffDepartment;
  status: ConversationStatus;
  messages: InboxMessageView[];
  assignee: {
    id: string;
    display_name: string;
    email: string;
  } | null;
  workflowCaption: string;
  currentStaffUserId: string;
  canManageAssignments: boolean;
  staffDirectory: StaffPickerOption[];
  conversationMetadata: unknown;
  aiEnabled: boolean;
  customerEmail: string | null;
  customerPhoneE164: string | null;
}) {
  const replyOk = canStaffReply(status);
  const afterHours = isAfterHoursWebChatIntake(conversationMetadata);
  const sentimentAlert = isSentimentEscalationActive(conversationMetadata);
  const latestMessageBody = getLatestMessageBody(messages);
  const channelSurface = resolveInboxChannelSurface({
    channel,
    metadata: conversationMetadata,
    title: conversationTitle,
  });

  return (
    <section
      key={conversationId}
      className="bg-background flex min-h-0 min-w-0 flex-1 flex-col"
    >
      <header className="from-muted/30 shrink-0 bg-gradient-to-b to-transparent px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-start gap-3.5">
          <div className="relative shrink-0">
            <div
              className="bg-muted/80 text-muted-foreground flex size-11 items-center justify-center rounded-md text-xs font-bold shadow-inner"
              aria-hidden
            >
              {customerInitials(customerDisplayName)}
            </div>
            <ConversationChannelAvatarChip surfaceId={channelSurface} />
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-foreground truncate text-[1.0625rem] font-bold tracking-[-0.03em] sm:text-[1.125rem]">
                {customerDisplayName}
              </h2>
              <ConversationChannelBadge surfaceId={channelSurface} size="md" />
              {afterHours ? (
                <Badge
                  variant="outline"
                  className="border-amber-300/80 bg-amber-50 text-xs font-medium text-amber-950 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-50"
                >
                  After-hours intake
                </Badge>
              ) : null}
              {sentimentAlert ? (
                <Badge variant="destructive" className="text-xs font-medium">
                  Sentiment alert · high priority
                </Badge>
              ) : null}
              <ConversationIntelligenceTags
                content={latestMessageBody}
                badgeClassName="text-xs font-medium"
              />
              <ConversationStatusBadge status={status} />
            </div>
            <p className="text-muted-foreground/72 flex items-center gap-1.5 text-[11px] font-normal leading-snug">
              <Badge
                variant="outline"
                className={cn(
                  "h-5 px-2 text-[10px] font-semibold",
                  departmentBadgeClass(department)
                )}
              >
                {formatDepartmentLabel(department)}
              </Badge>
              <span className="text-muted-foreground/55">·</span>
              <span className="text-muted-foreground/90">{inboxChannelSurfaceTagline(channelSurface)}</span>
            </p>
            <InboxCustomerProfileForm
              conversationId={conversationId}
              displayName={customerDisplayName}
              email={customerEmail}
              phoneE164={customerPhoneE164}
            />
          </div>
          <InboxConversationControlToggle
            conversationId={conversationId}
            status={status}
            conversationMetadata={conversationMetadata}
            aiEnabled={aiEnabled}
            assigneeId={assignee?.id ?? null}
            currentStaffUserId={currentStaffUserId}
          />
        </div>
      </header>

      <InboxAiHumanBanner
        status={status}
        metadata={conversationMetadata}
        assigneeDisplay={assignee ? assignee.display_name : null}
      />

      <InboxThreadToolbar
        id="inbox-thread-toolbar"
        conversationId={conversationId}
        status={status}
        department={department}
        assignee={assignee}
        workflowCaption={workflowCaption}
        currentStaffUserId={currentStaffUserId}
        canManageAssignments={canManageAssignments}
        staffDirectory={staffDirectory}
      />

      <ScrollArea className="min-h-0 flex-1">
        <InboxThreadMessages
          messages={messages}
          channelSurface={channelSurface}
          conversationId={conversationId}
        />
      </ScrollArea>

      <Separator />

      <InboxComposer
        conversationId={conversationId}
        messages={messages}
        channelSurface={channelSurface}
        canReply={replyOk}
        disabledReason={
          replyOk
            ? undefined
            : "This conversation is closed to new staff replies. Reopen from your CRM or admin tools when available."
        }
      />
    </section>
  );
}
