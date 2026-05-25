"use client";

import { Car, Send, WifiOff, X } from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  evaluateLiveHours,
  formatTimezoneShortLabel,
} from "@/lib/business-hours";
import type { BusinessHoursConfigV1 } from "@/lib/business-hours/types";
import { getClientPublicEnv } from "@/lib/env/client-public-env";
import { inferDepartmentFromPagePath } from "@/lib/widget/infer-department";
import {
  clearWidgetSession,
  loadWidgetSession,
  saveWidgetSession,
  type WidgetSessionRecord,
} from "@/components/widget/widget-session-storage";
import {
  widgetFetchMessages,
  widgetPostMessage,
  widgetStartConversation,
  type WidgetPublicMessage,
} from "@/components/widget/widget-api-client";
import {
  mergeWidgetBrand,
  type WidgetBrandTokens,
} from "@/components/widget/widget-brand";
import { getWidgetTopicWelcome } from "@/lib/widget/build-intent-opener";
import { WidgetLeadIntake } from "@/components/widget/lead-capture/widget-lead-intake";
import { WidgetPremiumLauncher } from "@/components/widget/widget-premium-launcher";
import type { LeadIntent } from "@/lib/widget/lead-capture/types";

import { cn } from "@/lib/utils";

const POLL_MS = 8000;

function hasAiReplyAfterLastCustomer(msgs: WidgetPublicMessage[]): boolean {
  let lastCustomer = -1;
  for (let i = msgs.length - 1; i >= 0; i--) {
    if (msgs[i]?.sender === "customer") {
      lastCustomer = i;
      break;
    }
  }
  if (lastCustomer < 0) {
    return false;
  }
  for (let i = lastCustomer + 1; i < msgs.length; i++) {
    if (msgs[i]?.sender === "ai") {
      return true;
    }
  }
  return false;
}

const DEFAULT_WELCOME =
  "Thanks for visiting. How can we help you find your next vehicle or service today?";

const DEFAULT_AFTER_HOURS =
  "We're closed for live chat right now. Leave a message below — our team will follow up when we're back.";

export type DealerChatWidgetProps = {
  dealershipSlug: string;
  /** Server-loaded hours for client-side “live hours” pill (matches start flow). */
  businessHoursConfig: BusinessHoursConfigV1;
  /** Override branding for other dealerships or white-label embeds. */
  brand?: Partial<WidgetBrandTokens>;
  /** Useful for local testing pages where the launcher can be easy to miss. */
  defaultOpen?: boolean;
  /**
   * Set by the server (see `/widget` page). If false in development, we show a visible hint:
   * inbound AI is skipped when `OPENAI_API_KEY` is missing or invalid.
   */
  openAiConfigured?: boolean;
  /** Full-page preview (`/widget`) vs floating embed on a dealer site. */
  presentation?: "embed" | "page";
};

/**
 * Embeddable floating chat: launcher + slide-up panel, real `/api/widget/*` backend,
 * session in `sessionStorage`. Host on your app origin and iframe this page, or mount
 * this component in a Next.js route with `businessHoursConfig` from the server.
 */
export function DealerChatWidget({
  dealershipSlug,
  businessHoursConfig,
  brand: brandPartial,
  defaultOpen = false,
  openAiConfigured = true,
  presentation = "embed",
}: DealerChatWidgetProps) {
  const isPage = presentation === "page";
  const brand = useMemo(() => mergeWidgetBrand(brandPartial), [brandPartial]);
  const env = useMemo(() => getClientPublicEnv(), []);
  const titleId = useId();
  const panelId = useId();
  const launcherId = useId();

  const [open, setOpen] = useState(defaultOpen);
  // Keep SSR and initial client render identical to avoid hydration mismatches.
  const [online, setOnline] = useState(true);
  const [withinLiveHours, setWithinLiveHours] = useState(true);
  const [session, setSession] = useState<WidgetSessionRecord | null>(null);
  const [messages, setMessages] = useState<WidgetPublicMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [hydrating, setHydrating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<"intake" | "chat">("intake");
  const [leadSubmitting, setLeadSubmitting] = useState(false);
  const [activeTopic, setActiveTopic] = useState<{
    intent: LeadIntent;
    title: string;
  } | null>(null);
  const [awaitingAiReply, setAwaitingAiReply] = useState(false);
  const [buildLabel, setBuildLabel] = useState<string | null>(null);
  const [hasStoredSession, setHasStoredSession] = useState(false);
  const [widgetApiOk, setWidgetApiOk] = useState<boolean | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const launcherBtnRef = useRef<HTMLButtonElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const aiReplyPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const welcomeText =
    env.NEXT_PUBLIC_WIDGET_WELCOME_MESSAGE?.trim() || DEFAULT_WELCOME;
  const afterHoursText =
    env.NEXT_PUBLIC_WIDGET_AFTER_HOURS_MESSAGE?.trim() || DEFAULT_AFTER_HOURS;

  const pagePath =
    typeof window !== "undefined"
      ? window.location.pathname + window.location.search
      : "/widget";

  const department = useMemo(
    () => inferDepartmentFromPagePath(pagePath),
    [pagePath]
  );

  const cssVars = useMemo(
    () =>
      ({
        "--widget-primary": brand.primary,
        "--widget-primary-hover": brand.primaryHover,
      }) as React.CSSProperties,
    [brand.primary, brand.primaryHover]
  );

  const widgetApiOrigin = useMemo(() => {
    const base =
      env.NEXT_PUBLIC_WIDGET_API_ORIGIN?.trim() || env.NEXT_PUBLIC_APP_URL;
    return base.replace(/\/$/, "");
  }, [env.NEXT_PUBLIC_APP_URL, env.NEXT_PUBLIC_WIDGET_API_ORIGIN]);

  const probeWidgetServer = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch(`${widgetApiOrigin}/api/widget/conversations`, {
        method: "OPTIONS",
      });
      return res.ok || res.status === 204 || res.status === 200;
    } catch {
      return false;
    }
  }, [widgetApiOrigin]);

  const applyConnectivityFromApi = useCallback(
    (result: { ok: boolean; code?: string }) => {
      if (result.ok) {
        setOnline(true);
        return;
      }
      if (result.code === "NETWORK") {
        setOnline(false);
      }
    },
    []
  );

  useEffect(() => {
    let cancelled = false;
    const runProbe = async () => {
      const reachable = await probeWidgetServer();
      if (cancelled) {
        return;
      }
      setWidgetApiOk(reachable);
      setOnline(reachable || navigator.onLine);
    };
    void runProbe();
    const interval = window.setInterval(() => void runProbe(), 60_000);
    const onBrowserOnline = () => void runProbe();
    window.addEventListener("online", onBrowserOnline);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener("online", onBrowserOnline);
    };
  }, [probeWidgetServer]);

  useEffect(() => {
    const tick = () => {
      const live = evaluateLiveHours(
        businessHoursConfig,
        department,
        new Date()
      );
      setWithinLiveHours(live.within_live_hours);
    };
    tick();
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, [businessHoursConfig, department]);

  const mergeById = useCallback(
    (prev: WidgetPublicMessage[], next: WidgetPublicMessage[]) => {
      const map = new Map<string, WidgetPublicMessage>();
      for (const m of prev) {
        map.set(m.id, m);
      }
      for (const m of next) {
        map.set(m.id, m);
      }
      return [...map.values()].sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
    },
    []
  );

  const refreshMessages = useCallback(
    async (tok: WidgetSessionRecord) => {
      const res = await widgetFetchMessages(
        env,
        tok.conversationId,
        tok.sessionToken
      );
      applyConnectivityFromApi(res);
      if (!res.ok) {
        if (res.code === "UNAUTHORIZED" || res.code === "NOT_FOUND") {
          clearWidgetSession(dealershipSlug);
          setSession(null);
          setMessages([]);
        }
        return;
      }
      setMessages((m) => {
        const merged = mergeById(m, res.messages);
        if (awaitingAiReply && hasAiReplyAfterLastCustomer(merged)) {
          setAwaitingAiReply(false);
        }
        return merged;
      });
    },
    [applyConnectivityFromApi, awaitingAiReply, dealershipSlug, env, mergeById]
  );

  /** Inbound AI runs after POST returns; poll briefly so async replies show without waiting 8s. */
  const refreshForAsyncAi = useCallback(
    (tok: WidgetSessionRecord) => {
      if (aiReplyPollRef.current) {
        clearInterval(aiReplyPollRef.current);
        aiReplyPollRef.current = null;
      }
      void refreshMessages(tok);
      let n = 0;
      const id = setInterval(() => {
        n += 1;
        void refreshMessages(tok);
        if (n >= 45) {
          clearInterval(id);
          aiReplyPollRef.current = null;
          setAwaitingAiReply(false);
          setError(
            "The assistant didn't reply in time. Choose another topic to start a fresh chat, or call the dealership."
          );
        }
      }, 1000);
      aiReplyPollRef.current = id;
    },
    [refreshMessages]
  );

  /** Refresh once when returning to a backgrounded tab. */
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible" && session && open) {
        void refreshMessages(session);
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [session, open, refreshMessages]);

  useEffect(() => {
    const base =
      env.NEXT_PUBLIC_WIDGET_API_ORIGIN?.trim() || env.NEXT_PUBLIC_APP_URL;
    const origin = base.replace(/\/$/, "");
    void fetch(`${origin}/api/widget/version`)
      .then((r) => r.json())
      .then((d: { widget_version?: string }) => {
        if (d.widget_version) {
          setBuildLabel(d.widget_version);
        }
      })
      .catch(() => {});
  }, [env.NEXT_PUBLIC_APP_URL, env.NEXT_PUBLIC_WIDGET_API_ORIGIN]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const stored = loadWidgetSession(dealershipSlug);
    setHasStoredSession(Boolean(stored));
    setSession(null);
    setMessages([]);
    setActiveTopic(null);
    setHydrating(false);
    setPhase("intake");
    setError(null);
  }, [open, dealershipSlug]);

  const continueLastChat = useCallback(async () => {
    const stored = loadWidgetSession(dealershipSlug);
    if (!stored) {
      return;
    }
    setSession(stored);
    setPhase("chat");
    setHydrating(true);
    setError(null);
    await refreshMessages(stored);
    setHydrating(false);
  }, [dealershipSlug, refreshMessages]);

  useEffect(() => {
    if (!open || !session) {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }
    const tick = () => {
      if (document.visibilityState !== "visible") {
        return;
      }
      void refreshMessages(session);
    };
    pollRef.current = setInterval(tick, POLL_MS);
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [open, session, refreshMessages]);

  useEffect(() => {
    if (!listRef.current) {
      return;
    }
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, open]);

  useEffect(() => {
    if (!open) {
      launcherBtnRef.current?.focus();
      return;
    }
    if (phase !== "chat") {
      return;
    }
    const t = window.setTimeout(() => composerRef.current?.focus(), 100);
    return () => window.clearTimeout(t);
  }, [open, phase]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const beginChatFromIntent = useCallback(
    async (intent: LeadIntent, cardTitle: string, initialText?: string) => {
      setLeadSubmitting(true);
      setError(null);
      clearWidgetSession(dealershipSlug);
      try {
        const started = await widgetStartConversation(env, {
          dealership_slug: dealershipSlug,
          page_path: pagePath,
          widget_intent: intent,
        });
        applyConnectivityFromApi(started);
        if (!started.ok) {
          const msg =
            started.code === "NOT_CONFIGURED" ||
            /not configured/i.test(started.message)
              ? "Chat is not available on the server yet. Please call the dealership or try again in a few minutes."
              : started.message;
          setError(msg);
          return;
        }
        const record: WidgetSessionRecord = {
          conversationId: started.conversation_id,
          sessionToken: started.session_token,
          expiresAt: started.expires_at,
          dealershipSlug,
        };
        saveWidgetSession(record);
        setSession(record);
        setMessages([]);
        setPhase("chat");

        const typed = initialText?.trim();
        if (typed) {
          setActiveTopic(null);
          setInput(typed);
        } else {
          setActiveTopic({ intent, title: cardTitle });
          setInput("");
        }
      } finally {
        setLeadSubmitting(false);
      }
    },
    [applyConnectivityFromApi, dealershipSlug, env, pagePath]
  );

  const ensureSession = useCallback(async (): Promise<WidgetSessionRecord | null> => {
    const existing = loadWidgetSession(dealershipSlug);
    if (existing) {
      setSession(existing);
      return existing;
    }
    const started = await widgetStartConversation(env, {
      dealership_slug: dealershipSlug,
      page_path: pagePath,
    });
    applyConnectivityFromApi(started);
    if (!started.ok) {
      setError(started.message);
      return null;
    }
    const record: WidgetSessionRecord = {
      conversationId: started.conversation_id,
      sessionToken: started.session_token,
      expiresAt: started.expires_at,
      dealershipSlug,
    };
    saveWidgetSession(record);
    setSession(record);
    return record;
  }, [applyConnectivityFromApi, dealershipSlug, env, pagePath]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      let tok = session ?? loadWidgetSession(dealershipSlug);
      if (!tok) {
        tok = await ensureSession();
      }
      if (!tok) {
        setLoading(false);
        return;
      }

      const res = await widgetPostMessage(
        env,
        tok.conversationId,
        tok.sessionToken,
        text
      );
      applyConnectivityFromApi(res);
      if (!res.ok) {
        if (res.code === "UNAUTHORIZED") {
          clearWidgetSession(dealershipSlug);
          setSession(null);
          const again = await ensureSession();
          if (again) {
            const retry = await widgetPostMessage(
              env,
              again.conversationId,
              again.sessionToken,
              text
            );
            applyConnectivityFromApi(retry);
            if (!retry.ok) {
              setError(retry.message);
            } else {
              setActiveTopic(null);
              setInput("");
              const bubbles: WidgetPublicMessage[] = [
                {
                  id: retry.id,
                  body: text,
                  created_at: retry.created_at,
                  sender: "customer",
                },
              ];
              if (retry.assistant_message) {
                bubbles.push(retry.assistant_message);
                setAwaitingAiReply(false);
              } else {
                setAwaitingAiReply(true);
                refreshForAsyncAi(again);
              }
              setMessages((m) => mergeById(m, bubbles));
            }
          }
        } else {
          setError(res.message);
        }
        setLoading(false);
        return;
      }

      setActiveTopic(null);
      setInput("");
      setError(null);
      const bubbles: WidgetPublicMessage[] = [
        {
          id: res.id,
          body: text,
          created_at: res.created_at,
          sender: "customer",
        },
      ];
      if (res.assistant_message) {
        bubbles.push(res.assistant_message);
        setAwaitingAiReply(false);
      } else {
        setAwaitingAiReply(true);
        refreshForAsyncAi(tok);
      }
      setMessages((m) => mergeById(m, bubbles));
    } finally {
      setLoading(false);
    }
  }, [
    applyConnectivityFromApi,
    input,
    loading,
    session,
    dealershipSlug,
    ensureSession,
    env,
    mergeById,
    refreshForAsyncAi,
  ]);

  const statusLabel = useMemo(() => {
    if (!online) {
      return "No connection";
    }
    if (!withinLiveHours) {
      return "Closed";
    }
    return "Online";
  }, [online, withinLiveHours]);

  const statusDot = useMemo(() => {
    if (!online) {
      return "bg-zinc-500";
    }
    if (!withinLiveHours) {
      return "bg-amber-400";
    }
    return "bg-emerald-400";
  }, [online, withinLiveHours]);

  const phoneTel = env.NEXT_PUBLIC_WIDGET_CONTACT_PHONE_TEL?.trim();
  const phoneLabel =
    env.NEXT_PUBLIC_WIDGET_CONTACT_PHONE_LABEL?.trim() || phoneTel;
  const contactEmail = env.NEXT_PUBLIC_WIDGET_CONTACT_EMAIL?.trim();
  const showContactCta =
    online && !withinLiveHours && (Boolean(phoneTel) || Boolean(contactEmail));

  const hasThread = messages.length > 0;
  const showWelcomeCard = !hasThread && !hydrating && phase === "chat";

  const rootClassName = cn(
    "widget-root isolate z-[2147483646] flex flex-col",
    isPage
      ? "pointer-events-auto min-h-[100dvh] items-center justify-center p-4 sm:p-6"
      : cn(
          "fixed right-0 bottom-0 items-end p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pl-[max(0.75rem,env(safe-area-inset-left))] sm:p-4 sm:pb-[max(1rem,env(safe-area-inset-bottom))]",
          open ? "pointer-events-auto" : "pointer-events-none"
        )
  );

  const embedShellClassName =
    "pointer-events-auto relative flex w-[min(100vw-1.25rem,400px)] flex-col items-stretch";

  const chatPanelClassName = cn(
    "pointer-events-auto flex flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0a0f1a] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.65)]",
    isPage
      ? "max-h-[min(92dvh,720px)] w-full max-w-[420px]"
      : "max-h-[min(560px,calc(100dvh-5.5rem))] w-[min(100vw-1.25rem,400px)] transition-[opacity,transform] duration-200 ease-out",
    !isPage &&
      (open ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-2 opacity-0")
  );

  const configBanner =
    widgetApiOk === false ? (
      <div
        className="pointer-events-auto mb-2 max-w-[min(100vw-1.25rem,400px)] rounded-lg border border-amber-500/40 bg-amber-950/90 px-3 py-2 text-[12px] leading-snug text-amber-50"
        role="alert"
      >
        Chat server is not fully configured. Conversations cannot be saved until{" "}
        <code className="text-[11px]">WIDGET_SESSION_SECRET</code> is set on Vercel (see docs).
      </div>
    ) : !openAiConfigured ? (
      <div
        className="pointer-events-auto mb-2 max-w-[min(100vw-1.25rem,400px)] rounded-lg border border-rose-500/35 bg-rose-950/80 px-3 py-2 text-[12px] leading-snug text-rose-100"
        role="status"
      >
        AI replies are off — add <code className="text-[11px]">OPENAI_API_KEY</code> on the server
        and redeploy.
      </div>
    ) : null;

  if (open && phase === "intake" && !session) {
    return (
      <div className={rootClassName} style={cssVars}>
        <div className={cn(!isPage && embedShellClassName)}>
          {configBanner}
        <WidgetLeadIntake
          brandTitle={brand.title}
          onClose={() => setOpen(false)}
          onBeginChat={(intent, title, text) => void beginChatFromIntent(intent, title, text)}
          onContinueChat={() => void continueLastChat()}
          canContinueChat={hasStoredSession}
          starting={leadSubmitting}
          presentation={presentation}
          error={error}
          buildLabel={buildLabel}
        />
        </div>
        {!isPage ? (
          <WidgetPremiumLauncher
            open={open}
            panelId={panelId}
            launcherId={launcherId}
            launcherBtnRef={launcherBtnRef}
            onToggle={() => {
              setOpen((wasOpen) => {
                if (!wasOpen) {
                  setPhase("intake");
                  setError(null);
                }
                return !wasOpen;
              });
            }}
          />
        ) : null}
      </div>
    );
  }

  return (
    <div className={rootClassName} style={cssVars}>
      <div className={cn(!isPage && embedShellClassName)}>
        {configBanner}
        <div
          id={panelId}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={chatPanelClassName}
        aria-hidden={!isPage && !open}
      >
        <header
          className="flex shrink-0 items-start justify-between gap-3 border-b border-zinc-800/80 px-4 py-3.5 text-white"
          style={{
            background: `linear-gradient(135deg, ${brand.headerFrom} 0%, ${brand.headerVia} 45%, ${brand.headerTo} 100%)`,
            // Fallback if Tailwind utilities fail to load (header gradient is inline; text-* would not apply).
            color: "#fafafa",
          }}
        >
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div
              className="flex size-11 shrink-0 items-center justify-center rounded-xl text-white shadow-inner ring-1 ring-white/10"
              style={{ backgroundColor: brand.primary }}
            >
              <Car className="size-5" aria-hidden />
            </div>
            <div className="min-w-0">
              <p id={titleId} className="truncate text-sm font-semibold tracking-tight">
                {brand.title}
              </p>
              <p className="text-zinc-400 truncate text-xs font-medium">
                {brand.tagline}
              </p>
              <p className="text-zinc-300 mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs">
                <span
                  className={cn("size-1.5 shrink-0 rounded-full", statusDot)}
                  aria-hidden
                />
                <span>{statusLabel}</span>
                <span className="text-zinc-500">·</span>
                <span className="text-zinc-400">
                  {formatTimezoneShortLabel(businessHoursConfig.timezone)}
                </span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-zinc-400 hover:text-white rounded-lg p-2 transition-colors focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:outline-none touch-manipulation"
            aria-label="Close chat"
          >
            <X className="size-5" />
          </button>
        </header>

        {!openAiConfigured ? (
          <div
            className="border-b border-rose-300 bg-rose-50 px-4 py-2.5 text-xs text-rose-950 dark:border-rose-900/60 dark:bg-rose-950/50 dark:text-rose-100"
            role="status"
          >
            <p className="font-semibold">OpenAI is not configured for this dev server</p>
            <p className="mt-1 leading-relaxed">
              Add <code className="rounded bg-rose-100/80 px-1 font-mono text-[0.7rem] dark:bg-rose-900/50">OPENAI_API_KEY</code> to{" "}
              <code className="rounded bg-rose-100/80 px-1 font-mono text-[0.7rem] dark:bg-rose-900/50">.env.local</code>, then restart{" "}
              <code className="rounded bg-rose-100/80 px-1 font-mono text-[0.7rem] dark:bg-rose-900/50">npm run dev</code>. No AI
              replies are generated until the key is valid.
            </p>
          </div>
        ) : null}

        {!online ? (
          <div className="border-b border-amber-200/80 bg-amber-50 px-4 py-2.5 text-xs text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100">
            <span className="inline-flex items-center gap-1.5 font-medium">
              <WifiOff className="size-3.5 shrink-0" aria-hidden />
              Can&apos;t reach the chat server right now. You can still type — we&apos;ll
              retry when you send.
            </span>
          </div>
        ) : null}

        {!withinLiveHours && online ? (
          <div className="border-b border-amber-200/80 bg-amber-50/90 px-4 py-3 text-xs text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/35 dark:text-amber-50">
            <p className="font-semibold tracking-tight">We&apos;re closed right now</p>
            <p className="mt-1.5 leading-relaxed">{afterHoursText}</p>
            <p className="text-amber-900/90 mt-2 leading-relaxed dark:text-amber-100/90">
              You can still send a message — we&apos;ll respond when we reopen, or reach
              us faster by phone or email if your request is urgent.
            </p>
          </div>
        ) : null}

        <div
          ref={listRef}
          className="widget-scroll-thin flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain px-5 py-5"
          role="log"
          aria-live="polite"
          aria-busy={hydrating}
        >
          {hydrating ? (
            <p className="text-muted-foreground text-center text-xs">
              Loading conversation…
            </p>
          ) : null}

          {showWelcomeCard && activeTopic ? (
            <TopicWelcomeBubble
              topicTitle={activeTopic.title}
              body={getWidgetTopicWelcome(activeTopic.intent)}
              brandTitle={brand.title}
            />
          ) : showWelcomeCard ? (
            <WelcomeCard
              withinLiveHours={withinLiveHours}
              online={online}
              welcomeText={welcomeText}
            />
          ) : null}

          {hasThread
            ? messages.map((m) => (
                <MessageBubble key={m.id} message={m} brandTitle={brand.title} />
              ))
            : null}

          {awaitingAiReply && !hasAiReplyAfterLastCustomer(messages) ? (
            <p className="px-1 text-[12px] text-zinc-400" role="status">
              Assistant is replying…
            </p>
          ) : null}
        </div>

        {error ? (
          <div className="text-destructive border-t border-border bg-destructive/5 px-4 py-2 text-xs">
            {error}
          </div>
        ) : null}

        <footer className="border-t border-white/[0.08] bg-[#070b14] p-4">
          {showContactCta ? (
            <div className="text-foreground mb-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] leading-snug">
              {phoneTel && phoneLabel ? (
                <span>
                  Phone:{" "}
                  <a
                    href={`tel:${phoneTel.replace(/\s/g, "")}`}
                    className="font-medium underline-offset-2 hover:underline"
                    style={{ color: "var(--widget-primary)" }}
                  >
                    {phoneLabel}
                  </a>
                </span>
              ) : null}
              {contactEmail ? (
                <span>
                  Email:{" "}
                  <a
                    href={`mailto:${encodeURIComponent(contactEmail)}`}
                    className="font-medium underline-offset-2 hover:underline"
                    style={{ color: "var(--widget-primary)" }}
                  >
                    {contactEmail}
                  </a>
                </span>
              ) : null}
            </div>
          ) : null}
          <div className="flex gap-2">
            <textarea
              ref={composerRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              placeholder={
                loading
                  ? "Assistant is replying…"
                  : withinLiveHours
                    ? "Type your message…"
                    : "Leave a message for our team…"
              }
              disabled={loading}
              rows={2}
              className="min-h-[48px] flex-1 resize-none rounded-xl border border-white/[0.12] bg-white/[0.06] px-4 py-2.5 text-[15px] text-white placeholder:text-zinc-500 focus:border-[#c8102e]/50 focus:outline-none focus:ring-2 focus:ring-[#c8102e]/30 disabled:opacity-60"
              aria-label="Message"
            />
            <button
              type="button"
              onClick={() => void send()}
              disabled={loading || !input.trim()}
              className="shrink-0 self-end rounded-xl px-4 py-3 text-sm font-medium text-white shadow-sm transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-40 touch-manipulation"
              style={{
                backgroundColor: "var(--widget-primary)",
              }}
              onMouseEnter={(e) => {
                if (!e.currentTarget.disabled) {
                  e.currentTarget.style.backgroundColor = "var(--widget-primary-hover)";
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "var(--widget-primary)";
              }}
            >
              {loading ? (
                <span className="px-0.5 text-[11px] font-medium" aria-hidden>
                  …
                </span>
              ) : (
                <Send className="size-4" aria-hidden />
              )}
              <span className="sr-only">Send</span>
            </button>
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <p className="text-[10px] leading-snug text-zinc-500">
              We may reply by SMS or email depending on your request. By messaging,
              you agree to our contact policies.
            </p>
            {session ? (
              <button
                type="button"
                onClick={() => {
                  clearWidgetSession(dealershipSlug);
                  setSession(null);
                  setMessages([]);
                  setActiveTopic(null);
                  setInput("");
                  setError(null);
                  setPhase("intake");
                }}
                className="shrink-0 text-[10px] font-medium text-zinc-400 underline-offset-2 hover:text-zinc-200 hover:underline"
              >
                Choose another topic
              </button>
            ) : null}
          </div>
        </footer>
        </div>
      </div>

      {!isPage ? (
        <WidgetPremiumLauncher
          open={open}
          panelId={panelId}
          launcherId={launcherId}
          launcherBtnRef={launcherBtnRef}
          onToggle={() => {
            setOpen((wasOpen) => {
              if (!wasOpen) {
                setPhase("intake");
                setError(null);
              }
              return !wasOpen;
            });
          }}
        />
      ) : null}
    </div>
  );
}

function TopicWelcomeBubble({
  topicTitle,
  body,
  brandTitle,
}: {
  topicTitle: string;
  body: string;
  brandTitle: string;
}) {
  return (
    <MessageBubble
      message={{
        id: "topic-welcome",
        body,
        created_at: new Date().toISOString(),
        sender: "ai",
      }}
      brandTitle={brandTitle}
      prefixLabel={topicTitle}
    />
  );
}

function WelcomeCard({
  withinLiveHours,
  online,
  welcomeText,
}: {
  withinLiveHours: boolean;
  online: boolean;
  welcomeText: string;
}) {
  return (
    <div className="space-y-3">
      <div className="bg-muted/40 rounded-2xl border border-border/70 p-4 shadow-sm">
        <p className="text-foreground/90 text-[13px] font-semibold leading-snug">
          {online && withinLiveHours ? "Welcome" : "Thanks for reaching out"}
        </p>
        <p className="text-foreground/85 mt-2 text-sm leading-relaxed">
          {welcomeText}
        </p>
      </div>
    </div>
  );
}

function MessageBubble({
  message,
  brandTitle,
  prefixLabel,
}: {
  message: WidgetPublicMessage;
  brandTitle: string;
  /** Optional context line above assistant copy (e.g. selected topic). */
  prefixLabel?: string;
}) {
  const isCustomer = message.sender === "customer";
  const senderLabel =
    message.sender === "staff"
      ? brandTitle
      : message.sender === "ai"
        ? "Assistant"
        : message.sender === "system"
          ? "Notice"
          : null;

  return (
    <div
      className={cn("flex w-full flex-col gap-0.5", isCustomer ? "items-end" : "items-start")}
    >
      {!isCustomer && senderLabel ? (
        <span className="px-1 text-[10px] font-medium tracking-wide text-zinc-500 uppercase">
          {senderLabel}
          {prefixLabel ? (
            <span className="normal-case tracking-normal text-zinc-400">
              {" "}
              · {prefixLabel}
            </span>
          ) : null}
        </span>
      ) : null}
      <div
        className={cn(
          "max-w-[88%] rounded-2xl px-4 py-3 text-[15px] leading-relaxed sm:max-w-[85%]",
          isCustomer
            ? "rounded-tr-md bg-[#c8102e] text-white shadow-lg shadow-[#c8102e]/20"
            : "rounded-tl-md border border-white/[0.08] bg-white/[0.07] text-zinc-100"
        )}
        style={
          isCustomer
            ? {
                backgroundColor: "var(--widget-primary)",
              }
            : undefined
        }
      >
        <p className="whitespace-pre-wrap break-words">{message.body}</p>
        {message.id !== "topic-welcome" ? (
          <time
            className={cn(
              "mt-1.5 block text-[10px] tabular-nums opacity-80",
              isCustomer ? "text-white/85" : "text-muted-foreground"
            )}
            dateTime={message.created_at}
          >
            {new Date(message.created_at).toLocaleTimeString(undefined, {
              hour: "numeric",
              minute: "2-digit",
            })}
          </time>
        ) : null}
      </div>
    </div>
  );
}
