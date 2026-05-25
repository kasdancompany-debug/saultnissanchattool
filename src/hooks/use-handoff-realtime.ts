"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { createSupabaseBrowserClient } from "@/integrations/supabase/browser";
import { getClientPublicEnv } from "@/lib/env/client-public-env";
import { isSupabaseConfigured } from "@/lib/env/public";
import { buildInboxHref } from "@/components/inbox/inbox-params";

export type HandoffAlert = {
  id: string;
  conversationId: string;
  department: string;
  title: string | null;
  occurredAt: string;
  inboxHref: string;
};

type ConversationRow = {
  id: string;
  status: string;
  department: string;
  title: string | null;
  updated_at: string;
};

/**
 * Subscribes to `conversations` status → `waiting_for_human` for the dealership.
 * Surfaces in-app alerts so handoffs are not missed when staff are on Overview/Settings.
 */
export function useHandoffRealtime(
  dealershipId: string,
  enabled: boolean
): {
  alerts: HandoffAlert[];
  dismissAlert: (id: string) => void;
  clearAlerts: () => void;
} {
  const [alerts, setAlerts] = useState<HandoffAlert[]>([]);
  const seenRef = useRef(new Set<string>());

  const dismissAlert = useCallback((id: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const clearAlerts = useCallback(() => {
    setAlerts([]);
  }, []);

  const pushAlert = useCallback((row: ConversationRow) => {
    const key = `${row.id}:${row.updated_at}`;
    if (seenRef.current.has(key)) return;
    seenRef.current.add(key);
    if (seenRef.current.size > 200) {
      const iter = seenRef.current.values();
      for (let i = 0; i < 50; i++) {
        const next = iter.next();
        if (next.done) break;
        seenRef.current.delete(next.value);
      }
    }

    const label =
      row.title?.trim() ||
      "Web chat customer";

    const alert: HandoffAlert = {
      id: key,
      conversationId: row.id,
      department: row.department,
      title: row.title,
      occurredAt: row.updated_at,
      inboxHref: buildInboxHref("all_open", {
        conversationId: row.id,
      }),
    };

    setAlerts((prev) => [alert, ...prev].slice(0, 8));

    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "granted") {
        try {
          new Notification("Customer needs a human", {
            body: `${label} — ${row.department} queue`,
            tag: row.id,
          });
        } catch {
          /* ignore */
        }
      }
    }

  }, []);

  useEffect(() => {
    if (!enabled || !dealershipId.trim()) return;
    if (!isSupabaseConfigured(getClientPublicEnv())) return;

    let supabase: ReturnType<typeof createSupabaseBrowserClient>;
    try {
      supabase = createSupabaseBrowserClient();
    } catch {
      return;
    }

    const channel = supabase
      .channel(`handoff:${dealershipId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "conversations",
          filter: `dealership_id=eq.${dealershipId}`,
        },
        (payload) => {
          const next = payload.new as ConversationRow | undefined;
          const prev = payload.old as ConversationRow | undefined;
          if (!next?.id) return;
          if (next.status !== "waiting_for_human") return;
          if (prev?.status === "waiting_for_human") return;
          pushAlert(next);
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [dealershipId, enabled, pushAlert]);

  return { alerts, dismissAlert, clearAlerts };
}
