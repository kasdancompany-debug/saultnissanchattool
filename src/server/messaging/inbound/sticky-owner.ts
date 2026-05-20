import "server-only";

import type { ConversationRow } from "@/server/data/conversations";

/** Predictable sticky-owner window for inbound routing when no active thread exists. */
export const STICKY_OWNER_WINDOW_HOURS = 168; // 7 days

function parseTimestampMs(input: string | null): number | null {
  if (!input) {
    return null;
  }
  const ms = Date.parse(input);
  return Number.isFinite(ms) ? ms : null;
}

/**
 * Returns true when a prior conversation is recent enough to reuse its owner for a new thread.
 */
export function isWithinStickyOwnerWindow(
  conversation: Pick<ConversationRow, "last_message_at" | "updated_at" | "created_at">,
  nowMs: number = Date.now(),
  windowHours: number = STICKY_OWNER_WINDOW_HOURS
): boolean {
  const basisMs =
    parseTimestampMs(conversation.last_message_at) ??
    parseTimestampMs(conversation.updated_at) ??
    parseTimestampMs(conversation.created_at);
  if (basisMs == null) {
    return false;
  }
  const ageMs = nowMs - basisMs;
  return ageMs >= 0 && ageMs <= windowHours * 60 * 60 * 1000;
}
