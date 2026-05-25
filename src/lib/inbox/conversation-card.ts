import type {
  ConversationStatus,
  MessageSenderType,
  Sentiment,
  StaffDepartment,
} from "@/integrations/supabase/database.types";
import type { InboxChannelSurfaceId } from "@/lib/conversation/inbox-channel-surface";
import { inboxChannelSurfaceLabel } from "@/lib/conversation/inbox-channel-surface";
import { deriveInboxLeadStatus, type InboxLeadStatus } from "@/lib/inbox/lead-status";
import { formatStaffDepartment } from "@/lib/settings/dealership-settings-v1";

export type InboxConversationCardContext = {
  sourceLabel: string;
  channelSurface: InboxChannelSurfaceId;
  departmentLabel: string;
  ownerLabel: string;
  ownerIsCurrentStaff: boolean;
  isUnassigned: boolean;
  leadStatus: InboxLeadStatus;
  unreadCount: number;
  responseTimerSeconds: number | null;
  responseTimerLabel: string | null;
  awaitingReply: boolean;
  sentiment: Sentiment;
  sentimentLabel: string;
};

export type InboxCardBuildInput = {
  status: ConversationStatus;
  department: StaffDepartment;
  metadata: unknown;
  createdAtIso: string;
  sentiment: Sentiment;
  assignee: { id: string; display_name: string } | null;
  lastMessagePreview: { created_at: string } | null;
  channelSurface: InboxChannelSurfaceId;
  currentStaffUserId: string;
  lastMessageSender: MessageSenderType | null;
  unreadCount: number;
};

export function formatCompactDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "—";
  const s = Math.round(seconds);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

export function sentimentLabel(sentiment: Sentiment): string {
  switch (sentiment) {
    case "positive":
      return "Positive";
    case "negative":
      return "Negative";
    case "neutral":
      return "Neutral";
    default:
      return "Unknown";
  }
}

export function buildInboxCardContext(input: InboxCardBuildInput): InboxConversationCardContext {
  const isUnassigned = input.assignee == null;
  const ownerIsCurrentStaff = input.assignee?.id === input.currentStaffUserId;
  const assigneeName = input.assignee?.display_name?.trim() ?? "";
  const ownerLabel = isUnassigned
    ? "Unassigned"
    : ownerIsCurrentStaff
      ? "You"
      : assigneeName.split(" ")[0] || "Staff";

  const awaitingReply =
    input.status === "waiting_for_human" || input.lastMessageSender === "customer";

  let responseTimerSeconds: number | null = null;
  if (awaitingReply && input.lastMessagePreview?.created_at) {
    const t = new Date(input.lastMessagePreview.created_at).getTime();
    if (!Number.isNaN(t)) {
      responseTimerSeconds = Math.max(0, Math.floor((Date.now() - t) / 1000));
    }
  }

  return {
    sourceLabel: inboxChannelSurfaceLabel(input.channelSurface),
    channelSurface: input.channelSurface,
    departmentLabel: formatStaffDepartment(input.department),
    ownerLabel,
    ownerIsCurrentStaff,
    isUnassigned,
    leadStatus: deriveInboxLeadStatus({
      status: input.status,
      department: input.department,
      metadata: input.metadata,
      hasAssignee: !isUnassigned,
      createdAtIso: input.createdAtIso,
    }),
    unreadCount: input.unreadCount,
    responseTimerSeconds,
    responseTimerLabel:
      responseTimerSeconds !== null
        ? formatCompactDuration(responseTimerSeconds)
        : null,
    awaitingReply,
    sentiment: input.sentiment,
    sentimentLabel: sentimentLabel(input.sentiment),
  };
}

export type MessageMetaRow = {
  conversation_id: string;
  sender_type: MessageSenderType;
  created_at: string;
};

/** Customer messages since the last staff reply (per conversation). */
export function computeUnreadFromMessageRows(
  rows: MessageMetaRow[]
): Map<string, { unreadCount: number; lastSender: MessageSenderType | null }> {
  const byConv = new Map<string, MessageMetaRow[]>();
  for (const row of rows) {
    const list = byConv.get(row.conversation_id) ?? [];
    list.push(row);
    byConv.set(row.conversation_id, list);
  }

  const out = new Map<string, { unreadCount: number; lastSender: MessageSenderType | null }>();

  for (const [convId, msgs] of byConv) {
    let unread = 0;
    let lastSender: MessageSenderType | null = null;
    for (const m of msgs) {
      if (m.sender_type === "staff") {
        unread = 0;
      } else if (m.sender_type === "customer") {
        unread += 1;
      }
      lastSender = m.sender_type;
    }
    out.set(convId, { unreadCount: unread, lastSender });
  }

  return out;
}
