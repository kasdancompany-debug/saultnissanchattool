import { buildContextualFollowUpFromMessage } from "@/lib/ai/contextual-follow-up";

export function normBodyForDedupe(body: string): string {
  return body
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[""''`]/g, "'")
    .trim();
}

/** True when two assistant lines are effectively the same template. */
export function isNearDuplicateAssistantReply(prev: string, next: string): boolean {
  const a = normBodyForDedupe(prev);
  const b = normBodyForDedupe(next);
  if (a === b) return true;
  if (a.length < 28 || b.length < 28) return false;
  const n = 72;
  return a.slice(0, n) === b.slice(0, n);
}

/**
 * If the proposed reply repeats the last assistant line, return a contextual follow-up
 * that references the customer's latest message instead.
 */
export function ensureDistinctAssistantReply(input: {
  proposed: string;
  lastAssistantMessage: string | null | undefined;
  latestCustomerMessage: string;
}): string {
  const proposed = input.proposed.trim();
  const last = input.lastAssistantMessage?.trim();
  if (!proposed || !last) {
    return proposed;
  }
  if (!isNearDuplicateAssistantReply(last, proposed)) {
    return proposed;
  }
  return buildContextualFollowUpFromMessage(input.latestCustomerMessage);
}
