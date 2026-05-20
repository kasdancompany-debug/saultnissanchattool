"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { createSupabaseBrowserClient } from "@/integrations/supabase/browser";
import { isSupabaseConfigured, publicEnv } from "@/lib/env/public";
import {
  COMPLETED_CONVERSATION_STATUSES,
  OPEN_QUEUE_STATUSES,
} from "@/lib/conversation/status-sets";

export type InboxQueueCounts = {
  allOpen: number;
  unassigned: number;
  waitingHuman: number;
  mine: number;
  sales: number;
  service: number;
  closed: number;
};

const initial: InboxQueueCounts = {
  allOpen: 0,
  unassigned: 0,
  waitingHuman: 0,
  mine: 0,
  sales: 0,
  service: 0,
  closed: 0,
};

/**
 * Client-side head counts for inbox tabs and status strip (RLS-scoped; same rules as list loaders).
 */
export function useInboxQueueCounts(
  dealershipId: string,
  staffUserId: string,
  pollMs = 45_000,
  includeDealershipWide = true
): { counts: InboxQueueCounts; loading: boolean; error: boolean } {
  const [counts, setCounts] = useState<InboxQueueCounts>(initial);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const mounted = useRef(true);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured(publicEnv)) {
      setLoading(false);
      setError(true);
      return;
    }
    let supabase: ReturnType<typeof createSupabaseBrowserClient>;
    try {
      supabase = createSupabaseBrowserClient();
    } catch {
      setLoading(false);
      setError(true);
      return;
    }

    const openStatuses = [...OPEN_QUEUE_STATUSES];
    const closedStatuses = [...COMPLETED_CONVERSATION_STATUSES];

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
          setError(true);
          setLoading(false);
        }
        return;
      }

      if (!mounted.current) return;

      const openRows = openRowsRes.data ?? [];
      let allOpen = 0;
      let unassigned = 0;
      let waitingHuman = 0;
      let mine = 0;
      let sales = 0;
      let service = 0;

      for (const row of openRows) {
        allOpen += 1;
        if (row.assigned_to_user_id == null) {
          unassigned += 1;
        }
        if (row.status === "waiting_for_human") {
          waitingHuman += 1;
        }
        if (row.assigned_to_user_id === staffUserId) {
          mine += 1;
        }
        if (row.department === "sales") {
          sales += 1;
        } else if (row.department === "service") {
          service += 1;
        }
      }

      setCounts({
        allOpen: includeDealershipWide ? allOpen : mine + unassigned,
        unassigned,
        waitingHuman: includeDealershipWide ? waitingHuman : 0,
        mine,
        sales: includeDealershipWide ? sales : 0,
        service: includeDealershipWide ? service : 0,
        closed: includeDealershipWide ? (closedCountRes.count ?? 0) : 0,
      });
      setError(false);
    } catch {
      if (mounted.current) setError(true);
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [dealershipId, staffUserId, includeDealershipWide]);

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
    if (!isSupabaseConfigured(publicEnv)) return;
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
