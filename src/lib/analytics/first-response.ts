import type { MessageSenderType } from "@/integrations/supabase/database.types";

export type MessageTimingRow = {
  conversation_id: string;
  sender_type: MessageSenderType;
  created_at: string;
};

/**
 * Computes average seconds from first **customer** message to first **staff** message
 * after that moment (per conversation). Ignores system/AI-only threads for the average.
 */
export function computeAverageFirstResponseSeconds(
  rows: MessageTimingRow[]
): { avgSeconds: number | null; measuredConversations: number } {
  if (rows.length === 0) {
    return { avgSeconds: null, measuredConversations: 0 };
  }

  const byConv = new Map<string, MessageTimingRow[]>();
  for (const r of rows) {
    const list = byConv.get(r.conversation_id) ?? [];
    list.push(r);
    byConv.set(r.conversation_id, list);
  }

  const deltas: number[] = [];

  for (const [, list] of byConv) {
    const sorted = [...list].sort((a, b) =>
      a.created_at.localeCompare(b.created_at)
    );

    let firstCustomerAt: string | null = null;
    for (const m of sorted) {
      if (m.sender_type === "customer") {
        firstCustomerAt = m.created_at;
        break;
      }
    }
    if (!firstCustomerAt) {
      continue;
    }

    const t0 = Date.parse(firstCustomerAt);
    if (Number.isNaN(t0)) {
      continue;
    }

    for (const m of sorted) {
      if (m.sender_type !== "staff") {
        continue;
      }
      const t1 = Date.parse(m.created_at);
      if (Number.isNaN(t1) || t1 <= t0) {
        continue;
      }
      deltas.push((t1 - t0) / 1000);
      break;
    }
  }

  if (deltas.length === 0) {
    return { avgSeconds: null, measuredConversations: 0 };
  }

  const sum = deltas.reduce((a, b) => a + b, 0);
  return {
    avgSeconds: sum / deltas.length,
    measuredConversations: deltas.length,
  };
}
