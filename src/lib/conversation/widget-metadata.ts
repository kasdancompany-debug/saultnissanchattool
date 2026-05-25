/**
 * Reads widget-specific flags stored on `conversations.metadata` by the web widget API.
 */

import type { Json } from "@/integrations/supabase/database.types";

/** Topic picked on the widget menu (`widget_intent` / `intake_intent`). */
export function readWidgetIntakeIntent(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }
  const w = (metadata as { widget?: { intake_intent?: string } }).widget;
  const intent = w?.intake_intent?.trim();
  return intent && intent.length > 0 ? intent : null;
}

export function isAfterHoursWebChatIntake(metadata: unknown): boolean {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return false;
  }
  const w = (metadata as { widget?: { after_hours?: boolean } }).widget;
  return w?.after_hours === true;
}

/** True after the one-shot service after-hours AI acknowledgement was persisted. */
export function isWidgetAiIntroMessageSent(metadata: unknown): boolean {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return false;
  }
  const w = (metadata as { widget?: { ai_intro_message_sent?: boolean } }).widget;
  return w?.ai_intro_message_sent === true;
}

/** Returns metadata with `widget.ai_intro_message_sent` set (one-shot after-hours acknowledgement). */
export function withWidgetAiIntroMessageSent(metadata: Json): Json {
  const base =
    metadata && typeof metadata === "object" && !Array.isArray(metadata)
      ? { ...(metadata as Record<string, unknown>) }
      : {};
  const prevWidget =
    base.widget &&
    typeof base.widget === "object" &&
    !Array.isArray(base.widget)
      ? { ...(base.widget as Record<string, unknown>) }
      : {};
  return {
    ...base,
    widget: {
      ...prevWidget,
      ai_intro_message_sent: true,
    },
  } as Json;
}
