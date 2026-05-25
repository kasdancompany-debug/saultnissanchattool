"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { createSupabaseBrowserClient } from "@/integrations/supabase/browser";
import { getClientPublicEnv } from "@/lib/env/client-public-env";
import { isSupabaseConfigured } from "@/lib/env/public";
import {
  computeInboxQueueCountsFromRows,
  closedStatusesForInboxCounts,
  openStatusesForInboxCounts,
  EMPTY_INBOX_QUEUE_COUNTS,
  type InboxQueueCounts,
} from "@/lib/inbox/compute-queue-counts";

export type { InboxQueueCounts };

/**
 * Client-side head counts for inbox tabs and status strip (RLS-scoped).
 * Prefer `initialCounts` from the server so badges match the list on first paint.
 */
export function useInboxQueueCounts(
  dealershipId: string,
  staffUserId: string,
  pollMs = 45_000,
  includeDealershipWide = true,
  initialCounts?: InboxQueueCounts
): { counts: InboxQueueCounts; loading: boolean; error: boolean } {
  const [counts, setCounts] = useState<InboxQueueCounts>(
    initialCounts ?? EMPTY_INBOX_QUEUE_COUNTS
  );
  const [loading, setLoading] = useState(!initialCounts);
  const [error, setError] = useState(false);
  const mounted = useRef(true);

  const load = useCallback(async () => {
    const env = getClientPublicEnv();
    if (!isSupabaseConfigured(env)) {
      if (initialCounts) {
        setCounts(initialCounts);
        setError(false);
        setLoading(false);
        return;
      }
      setLoading(false);
      setError(true);
      return;
    }
    let supabase: ReturnType<typeof createSupabaseBrowserClient>;
    try {
      supabase = createSupabaseBrowserClient();
    } catch {
      if (initialCounts) {
        setCounts(initialCounts);
        setError(false);
      } else {
        setError(true);
      }
      setLoading(false);
      return;
    }

    const openStatuses = openStatusesForInboxCounts();
    const closedStatuses = closedStatusesForInboxCounts();

    try {
      const [openRowsRes, closedCountRes] = await Promise.all([
        supabase
          .from("conversations")
          .select("status, assigned_to_user_id, department")
          .eq("dealership_id", dealershipId)
          .in("status", openStatuses),
        supabase
          .from("conversations")
          .select("id", { count: "exact", head: true })
          .eq("dealership_id", dealershipId)
          .in("status", closedStatuses),
      ]);

      if (openRowsRes.error || closedCountRes.error) {
        if (mounted.current) {
          if (initialCounts) {
            setCounts(initialCounts);
            setError(false);
          } else {
            setError(true);
          }
          setLoading(false);
        }
        return;
      }

      if (!mounted.current) return;

      setCounts(
        computeInboxQueueCountsFromRows(
          openRowsRes.data ?? [],
          closedCountRes.count ?? 0,
          staffUserId,
          includeDealershipWide
        )
      );
      setError(false);
    } catch {
      if (mounted.current) {
        if (initialCounts) {
          setCounts(initialCounts);
          setError(false);
        } else {
          setError(true);
        }
      }
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [dealershipId, staffUserId, includeDealershipWide, initialCounts]);

  useEffect(() => {
    mounted.current = true;
    void load();
    const t = window.setInterval(() => void load(), pollMs);
    return () => {
      mounted.current = false;
      window.clearInterval(t);
    };
  }, [load, pollMs]);

  useEffect(() => {
    const env = getClientPublicEnv();
    if (!isSupabaseConfigured(env)) return;
    let supabase: ReturnType<typeof createSupabaseBrowserClient>;
    try {
      supabase = createSupabaseBrowserClient();
    } catch {
      return;
    }

    const channel = supabase
      .channel(`inbox-counts:${dealershipId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "conversations",
          filter: `dealership_id=eq.${dealershipId}`,
        },
        () => {
          void load();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [dealershipId, load]);

  return { counts, loading, error };
}
