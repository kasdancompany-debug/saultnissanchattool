import type { ConversationStatus } from "@/integrations/supabase/database.types";

/**
 * Single source of truth for “active queue” conversations (inbox, analytics, SMS helpers).
 * Keep in sync with product rules when adding statuses.
 */
export const OPEN_QUEUE_STATUSES: readonly ConversationStatus[] = [
  "open",
  "pending",
  "waiting_for_human",
];

/** Terminal outcomes used for reporting (excludes `spam`). */
export const COMPLETED_CONVERSATION_STATUSES: readonly ConversationStatus[] = [
  "closed",
  "resolved",
  "archived",
];
