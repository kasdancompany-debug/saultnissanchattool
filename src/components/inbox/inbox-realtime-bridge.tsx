"use client";

import { startTransition, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";

import { createSupabaseBrowserClient } from "@/integrations/supabase/browser";
import { isSupabaseConfigured, publicEnv } from "@/lib/env/public";
import { shouldSuppressRealtimeInboxRefresh } from "@/lib/inbox-client-refresh-coord";
import {
  inboxRealtimeRefreshDedupeKey,
  RealtimeRefreshDedupe,
} from "@/lib/inbox/realtime-dedupe";

/** Coalesces bursts (e.g. message INSERT + conversation row bump in one transaction). */
const DEBOUNCE_MS = 280;

type PostgresChangesPayload = Parameters<
  Parameters<
    ReturnType<
      ReturnType<typeof createSupabaseBrowserClient>["channel"]
    >["on"]
  >[2]
>[0];

/**
 * Supabase Realtime (`postgres_changes`) for the inbox: one multiplexed channel per
 * `(dealership, selected thread)` so subscribe/unsubscribe stays in sync and we do not
 * accumulate stale listeners.
 *
 * **Data flow:** `router.refresh()` re-fetches RSC payloads (list + open thread). No client-side
 * message merge — keeps behavior correct and simple.
 *
 * **List updates:** `conversations` changes (dealership filter) cover assignment, status, and
 * `last_message_at` bumps from the `messages_bump_conversation_last_message_at` trigger on new
 * messages in any thread.
 *
 * **Active thread:** Same `conversations` stream plus `messages` INSERT/UPDATE for the selected
 * `conversation_id` so the transcript and list both move without a manual refresh.
 *
 * **Dedupe:** {@link inboxRealtimeRefreshDedupeKey} collapses message + conversation events that
 * share the same `commit_timestamp` and conversation id (single logical write).
 *
 * **Edge cases**
 * - **Initial load:** Realtime does not replay history; the server render is the source of truth.
 * - **Reconnect:** After offline, `window.online` triggers one refresh to cover missed events.
 *   Brief gaps are possible before that refresh completes.
 * - **Fast thread switching:** A monotonic `subscriptionEpoch` ignores callbacks from a previous
 *   subscription if a race delivers late.
 * - **Staff action + realtime:** {@link shouldSuppressRealtimeInboxRefresh} avoids double refresh
 *   when the composer/toolbar already called `router.refresh()`.
 */
export function InboxRealtimeBridge({
  dealershipId,
  selectedConversationId,
  children,
}: {
  dealershipId: string;
  selectedConversationId: string | null;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const supabase = useMemo(() => {
    if (!isSupabaseConfigured(publicEnv)) {
      return null;
    }
    try {
      return createSupabaseBrowserClient();
    } catch {
      return null;
    }
  }, []);

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dedupeRef = useRef(new RealtimeRefreshDedupe());
  const mountedRef = useRef(true);
  const subscriptionEpochRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!supabase) {
      return;
    }

    const epoch = ++subscriptionEpochRef.current;
    const dedupe = dedupeRef.current;
    dedupe.clear();

    const scheduleRefresh = (reason: string) => {
      if (epoch !== subscriptionEpochRef.current) {
        return;
      }
      if (debounceTimerRef.current !== null) {
        clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = setTimeout(() => {
        debounceTimerRef.current = null;
        if (!mountedRef.current || epoch !== subscriptionEpochRef.current) {
          return;
        }
        if (shouldSuppressRealtimeInboxRefresh()) {
          return;
        }
        startTransition(() => {
          router.refresh();
        });
        if (process.env.NODE_ENV === "development") {
          console.debug("[inbox realtime] refresh", reason);
        }
      }, DEBOUNCE_MS);
    };

    const onPostgresChange = (payload: PostgresChangesPayload) => {
      if (epoch !== subscriptionEpochRef.current) {
        return;
      }
      const key = inboxRealtimeRefreshDedupeKey(payload);
      if (!dedupe.shouldHandle(key)) {
        return;
      }
      scheduleRefresh(
        `postgres_changes:${payload.table}:${payload.eventType}`
      );
    };

    const channelName = `inbox:${dealershipId}:${selectedConversationId ?? "none"}`;
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "conversations",
          filter: `dealership_id=eq.${dealershipId}`,
        },
        onPostgresChange
      );

    if (selectedConversationId) {
      const cid = selectedConversationId;
      channel.on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${cid}`,
        },
        onPostgresChange
      );
    }

    channel.subscribe((status, err) => {
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        if (process.env.NODE_ENV === "development") {
          console.warn(
            "[inbox realtime] channel",
            channelName,
            status,
            err?.message ?? ""
          );
        }
      }
    });

    const onOnline = () => {
      if (epoch !== subscriptionEpochRef.current) {
        return;
      }
      dedupe.clear();
      scheduleRefresh("window.online");
    };
    window.addEventListener("online", onOnline);

    return () => {
      window.removeEventListener("online", onOnline);

      if (debounceTimerRef.current !== null) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }

      dedupe.clear();
      void supabase.removeChannel(channel);
    };
  }, [supabase, dealershipId, selectedConversationId, router]);

  return <>{children}</>;
}
