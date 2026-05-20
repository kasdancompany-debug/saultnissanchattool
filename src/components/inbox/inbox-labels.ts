import type {
  ConversationChannel,
  ConversationStatus,
  StaffDepartment,
} from "@/integrations/supabase/database.types";
import type { InboxFilter } from "@/server/data/inbox";

const CHANNEL: Record<ConversationChannel, string> = {
  sms: "SMS",
  web_chat: "Web chat",
  email: "Email",
  facebook: "Messenger",
  other: "Other",
};

const DEPARTMENT: Record<StaffDepartment, string> = {
  sales: "Sales",
  service: "Service",
  parts: "Parts",
  bdc: "BDC",
  management: "Management",
  general: "General",
};

const STATUS: Record<ConversationStatus, string> = {
  open: "Open",
  pending: "Pending",
  waiting_for_human: "Needs human",
  resolved: "Resolved",
  closed: "Closed",
  archived: "Archived",
  spam: "Spam",
};

export function formatChannelLabel(channel: ConversationChannel): string {
  return CHANNEL[channel] ?? channel;
}

export function formatDepartmentLabel(department: StaffDepartment): string {
  return DEPARTMENT[department] ?? department;
}

export function formatStatusLabel(status: ConversationStatus): string {
  return STATUS[status] ?? status;
}

/** Short line under the conversation list header for the active filter. */
export function inboxListSubtitle(filter: InboxFilter): string {
  switch (filter) {
    case "all_open":
      return "Open queue across your shared SMS number and chat channels, with a clear internal owner on every thread.";
    case "mine":
      return "Customers currently owned by you.";
    case "unassigned":
      return "Open conversations waiting for a teammate to claim ownership.";
    case "sales":
      return "Sales queue with owner-based handoff and follow-up.";
    case "service":
      return "Service queue with owner-based handoff and follow-up.";
    case "closed":
      return "Resolved, closed, and archived conversations (ownership history preserved).";
    default:
      return "";
  }
}

export function filterTabLabel(filter: InboxFilter): string {
  switch (filter) {
    case "all_open":
      return "All Open";
    case "mine":
      return "My Customers";
    case "unassigned":
      return "Unassigned";
    case "sales":
      return "Sales";
    case "service":
      return "Service";
    case "closed":
      return "Closed";
    default:
      return "Inbox";
  }
}

/** Ownership-focused helper line for top tab chrome. */
export function inboxOwnershipViewHint(filter: InboxFilter): string {
  switch (filter) {
    case "mine":
      return "View: conversations owned by you.";
    case "unassigned":
      return "View: conversations with no owner yet.";
    case "all_open":
      return "View: all open conversations with their current owner.";
    case "sales":
      return "View: Sales conversations and their owners.";
    case "service":
      return "View: Service conversations and their owners.";
    case "closed":
      return "View: closed history with preserved ownership context.";
    default:
      return "View: ownership-focused inbox.";
  }
}
