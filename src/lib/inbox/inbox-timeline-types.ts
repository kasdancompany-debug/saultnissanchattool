import type { ConversationEventType } from "@/integrations/supabase/database.types";
import type { InboxMessageView } from "@/lib/inbox/inbox-message-view";

/** Minimal event shape for timeline parsing (server-loaded, client-rendered). */
export type TimelineSourceEvent = {
  id: string;
  created_at: string;
  event_type: ConversationEventType;
  actor_user_id: string | null;
  payload: unknown;
};

export type TimelineActivityTone =
  | "intent"
  | "proposed"
  | "confirmed"
  | "edited"
  | "completed"
  | "no_show"
  | "cancelled"
  | "scheduler"
  | "neutral";

export type InboxTimelineActivity = {
  id: string;
  created_at: string;
  kind: string;
  title: string;
  detail: string | null;
  tone: TimelineActivityTone;
  actorLabel: string | null;
};

export type InboxThreadTimelineItem =
  | { type: "message"; sortKey: string; message: InboxMessageView }
  | { type: "activity"; sortKey: string; activity: InboxTimelineActivity };
