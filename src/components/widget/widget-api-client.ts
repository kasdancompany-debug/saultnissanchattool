import type { PublicEnv } from "@/lib/env/schema";

export type WidgetLiveHoursPayload = {
  within_live_hours: boolean;
  after_hours: boolean;
  timezone: string;
  schedule_key: string;
  evaluated_at: string;
};

export type WidgetPublicMessage = {
  id: string;
  body: string;
  created_at: string;
  sender: "customer" | "staff" | "system" | "ai";
};

async function safeJson<T>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<
  | { ok: true; response: Response; data: T }
  | { ok: false; code: string; message: string }
> {
  try {
    const response = await fetch(input, init);
    let data: T | null = null;
    try {
      data = (await response.json()) as T;
    } catch {
      data = null;
    }
    if (!response.ok) {
      const err = (data as { error?: { code?: string; message?: string } } | null)?.error;
      return {
        ok: false,
        code: err?.code ?? "ERROR",
        message: err?.message ?? "Request failed",
      };
    }
    if (data == null) {
      return { ok: false, code: "INVALID", message: "Invalid response" };
    }
    return { ok: true, response, data };
  } catch (error) {
    return {
      ok: false,
      code: "NETWORK",
      message: error instanceof Error ? error.message : "Failed to fetch",
    };
  }
}

function apiBase(env: PublicEnv): string {
  const raw = env.NEXT_PUBLIC_WIDGET_API_ORIGIN?.trim();
  if (raw) {
    return raw.replace(/\/$/, "");
  }
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin.replace(/\/$/, "");
  }
  return env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
}

function headers(env: PublicEnv, sessionToken?: string): HeadersInit {
  const h: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (env.NEXT_PUBLIC_WIDGET_API_KEY) {
    h["X-Widget-Key"] = env.NEXT_PUBLIC_WIDGET_API_KEY;
  }
  if (sessionToken) {
    h.Authorization = `Bearer ${sessionToken}`;
  }
  return h;
}

export async function widgetStartConversation(
  env: PublicEnv,
  body: {
    dealership_slug: string;
    page_path?: string;
    department?: string;
    display_name?: string;
    lead_capture?: Record<string, unknown>;
  }
): Promise<
  | {
      ok: true;
      conversation_id: string;
      session_token: string;
      expires_at: string;
      live_hours: WidgetLiveHoursPayload;
    }
  | { ok: false; code: string; message: string }
> {
  const result = await safeJson<{
    conversation_id?: string;
    session_token?: string;
    expires_at?: string;
    live_hours?: WidgetLiveHoursPayload;
    error?: { code?: string; message?: string };
  }>(`${apiBase(env)}/api/widget/conversations`, {
    method: "POST",
    headers: headers(env),
    body: JSON.stringify(body),
  });
  if (!result.ok) {
    return result;
  }
  const data = result.data;
  if (
    !data.conversation_id ||
    !data.session_token ||
    !data.expires_at ||
    !data.live_hours
  ) {
    return { ok: false, code: "INVALID", message: "Invalid response" };
  }
  return {
    ok: true,
    conversation_id: data.conversation_id,
    session_token: data.session_token,
    expires_at: data.expires_at,
    live_hours: data.live_hours,
  };
}

export async function widgetFetchMessages(
  env: PublicEnv,
  conversationId: string,
  sessionToken: string
): Promise<
  | { ok: true; messages: WidgetPublicMessage[] }
  | { ok: false; code: string; message: string }
> {
  const result = await safeJson<{
    messages?: WidgetPublicMessage[];
    error?: { code?: string; message?: string };
  }>(
    `${apiBase(env)}/api/widget/conversations/${encodeURIComponent(conversationId)}/messages`,
    {
      method: "GET",
      headers: headers(env, sessionToken),
    }
  );
  if (!result.ok) {
    return result;
  }
  return { ok: true, messages: result.data.messages ?? [] };
}

export async function widgetPostMessage(
  env: PublicEnv,
  conversationId: string,
  sessionToken: string,
  text: string
): Promise<
  | { ok: true; id: string; created_at: string }
  | { ok: false; code: string; message: string }
> {
  const result = await safeJson<{
    id?: string;
    created_at?: string;
    error?: { code?: string; message?: string };
  }>(
    `${apiBase(env)}/api/widget/conversations/${encodeURIComponent(conversationId)}/messages`,
    {
      method: "POST",
      headers: headers(env, sessionToken),
      body: JSON.stringify({ text }),
    }
  );
  if (!result.ok) {
    return result;
  }
  const data = result.data;
  if (!data.id || !data.created_at) {
    return { ok: false, code: "INVALID", message: "Invalid response" };
  }
  return { ok: true, id: data.id, created_at: data.created_at };
}
