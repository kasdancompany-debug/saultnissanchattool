export type WidgetSessionRecord = {
  conversationId: string;
  sessionToken: string;
  expiresAt: string;
  dealershipSlug: string;
};

/** Per-dealership session; safe for multi-brand embeds. */
const KEY_PREFIX = "web_chat_widget_session_v1";

function storageKey(dealershipSlug: string): string {
  return `${KEY_PREFIX}:${dealershipSlug}`;
}

export function loadWidgetSession(
  dealershipSlug: string
): WidgetSessionRecord | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = sessionStorage.getItem(storageKey(dealershipSlug));
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as WidgetSessionRecord;
    if (
      !parsed.conversationId ||
      !parsed.sessionToken ||
      !parsed.expiresAt ||
      parsed.dealershipSlug !== dealershipSlug
    ) {
      return null;
    }
    if (new Date(parsed.expiresAt).getTime() <= Date.now()) {
      sessionStorage.removeItem(storageKey(dealershipSlug));
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveWidgetSession(record: WidgetSessionRecord): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    sessionStorage.setItem(
      storageKey(record.dealershipSlug),
      JSON.stringify(record)
    );
  } catch {
    // quota / private mode
  }
}

export function clearWidgetSession(dealershipSlug: string): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    sessionStorage.removeItem(storageKey(dealershipSlug));
  } catch {
    // ignore
  }
}
