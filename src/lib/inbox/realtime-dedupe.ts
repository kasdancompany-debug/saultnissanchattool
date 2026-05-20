/**
 * Short-window dedupe for Supabase Realtime `postgres_changes` deliveries.
 * The same logical change can occasionally be observed more than once around reconnects;
 * we only need one UI refresh per row/event within the TTL.
 */
export class RealtimeRefreshDedupe {
  private readonly ttlMs: number;
  private readonly seen = new Map<string, number>();

  constructor(ttlMs = 4000) {
    this.ttlMs = ttlMs;
  }

  /** Returns true if this key should trigger work (first time or expired). */
  shouldHandle(key: string, now = Date.now()): boolean {
    this.prune(now);
    const prev = this.seen.get(key);
    if (prev !== undefined && now - prev < this.ttlMs) {
      return false;
    }
    this.seen.set(key, now);
    return true;
  }

  prune(now: number): void {
    for (const [k, t] of this.seen) {
      if (now - t > this.ttlMs) {
        this.seen.delete(k);
      }
    }
  }

  clear(): void {
    this.seen.clear();
  }
}

type PostgresChangePayload = {
  table?: string;
  eventType?: string;
  schema?: string;
  /** Present on Supabase Realtime `postgres_changes` payloads. */
  commit_timestamp?: string;
  new?: Record<string, unknown> | null;
  old?: Record<string, unknown> | null;
};

/**
 * Stable key for deduping: prefer primary id + event type + commit timestamp when present.
 */
export function postgresChangeDedupeKey(payload: PostgresChangePayload): string {
  const table = payload.table ?? "unknown";
  const et = payload.eventType ?? "unknown";
  const row = (payload.new ?? payload.old) as { id?: unknown } | null | undefined;
  const id = row && typeof row.id === "string" ? row.id : "no-id";
  const commit = payload.commit_timestamp ?? "";
  return `${table}:${et}:${id}:${commit}`;
}

/**
 * Dedupe key optimized for inbox refresh: message INSERT and the follow-up `conversations`
 * UPDATE (same transaction, same `commit_timestamp`) collapse to one key so we do not schedule
 * redundant `router.refresh()` work for the same logical event.
 */
export function inboxRealtimeRefreshDedupeKey(
  payload: PostgresChangePayload
): string {
  const commit = payload.commit_timestamp ?? "";
  const table = payload.table ?? "";
  const newRow = payload.new as
    | { id?: unknown; conversation_id?: unknown }
    | null
    | undefined;
  const oldRow = payload.old as
    | { id?: unknown; conversation_id?: unknown }
    | null
    | undefined;

  let convId: string | null = null;
  if (table === "conversations") {
    const id = newRow?.id ?? oldRow?.id;
    convId = typeof id === "string" ? id : null;
  } else if (table === "messages") {
    const cid = newRow?.conversation_id;
    convId = typeof cid === "string" ? cid : null;
  }

  if (commit && convId) {
    return `inbox:${commit}:${convId}`;
  }

  return postgresChangeDedupeKey(payload);
}
