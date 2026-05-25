import type {
  ConversationChannel,
  ConversationStatus,
  Json,
} from "@/integrations/supabase/database.types";
import { OPEN_QUEUE_STATUSES } from "@/lib/conversation/status-sets";

export type ConversationHandlingMode =
  | "ai_active"
  | "waiting_for_human"
  | "claimed_by_staff";

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

/**
 * Shallow merge `metadata.control` with `controlPatch` (safe for client + server).
 */
export function mergeConversationControl(
  previous: Json,
  controlPatch: Record<string, unknown>
): Json {
  const base = asRecord(previous);
  const prevControl = asRecord(base.control);
  return {
    ...base,
    control: {
      ...prevControl,
      ...controlPatch,
    },
  } as Json;
}

/** Default for new threads: AI may triage; no autopilot sends. */
export function defaultAiLeadControl(): Record<string, unknown> {
  return {
    handling_mode: "ai_active" satisfies ConversationHandlingMode,
    mode: "ai_led",
    ai_mode: "triage",
    ai_autopilot: false,
  };
}

/** Public web widget: AI sends customer-facing replies until staff claims the thread. */
export function widgetWebChatControl(): Record<string, unknown> {
  return {
    handling_mode: "ai_active" satisfies ConversationHandlingMode,
    mode: "ai_led",
    ai_mode: "triage",
    ai_autopilot: true,
  };
}

export function isConversationHumanControlled(metadata: unknown): boolean {
  const control = asRecord(asRecord(metadata).control);
  if (control.mode === "human_led") {
    return true;
  }
  if (control.handling_mode === "claimed_by_staff") {
    return true;
  }
  return false;
}

/** Inbox UI + response-mode toggle: human when metadata says so or status is queued for staff. */
export function getConversationResponseModeForUi(
  metadata: unknown,
  status: string
): "ai" | "human" {
  if (status === "waiting_for_human") {
    return "human";
  }
  return isConversationHumanControlled(metadata) ? "human" : "ai";
}

/**
 * **Web chat only** — whether automated customer-facing triage is allowed.
 * Inbox still treats `waiting_for_human` as “human mode”, but the widget must keep replying
 * with safe triage after AI flags escalation, until a teammate has **claimed** the thread
 * (see `isConversationHumanControlled`).
 */
export function isWebChatAutomatedTriageUnblocked(
  channel: ConversationChannel,
  aiEnabled: boolean,
  status: ConversationStatus,
  metadata: unknown
): boolean {
  if (channel !== "web_chat" || !aiEnabled) {
    return false;
  }
  if (isConversationHumanControlled(metadata)) {
    return false;
  }
  return OPEN_QUEUE_STATUSES.includes(status);
}

/** Staff explicitly enables AI-led handling + automated customer replies where policy allows. */
export function aiLeadAutoReplyControlPatch(): Record<string, unknown> {
  return {
    handling_mode: "ai_active",
    mode: "ai_led",
    ai_mode: "triage",
    ai_autopilot: true,
  };
}

/** Staff-led: no automated customer-facing AI messages; inbox assist may still run. */
export function humanManualOnlyControlPatch(
  staffUserId: string
): Record<string, unknown> {
  return {
    handling_mode: "claimed_by_staff",
    mode: "human_led",
    ai_mode: "assist",
    ai_autopilot: false,
    claimed_by: staffUserId,
    claimed_at: new Date().toISOString(),
  };
}

/**
 * Derives a single handling mode for UI + branching (status wins over stale metadata when queued for human).
 */
export function resolveConversationHandlingMode(
  metadata: unknown,
  status: string
): ConversationHandlingMode {
  if (isConversationHumanControlled(metadata)) {
    return "claimed_by_staff";
  }
  if (status === "waiting_for_human") {
    return "waiting_for_human";
  }
  const hm = asRecord(asRecord(metadata).control).handling_mode;
  if (hm === "waiting_for_human") {
    return "waiting_for_human";
  }
  return "ai_active";
}

export function getHumanAiControlLabel(
  metadata: unknown,
  aiEnabled: boolean,
  status: string
): string {
  const mode = resolveConversationHandlingMode(metadata, status);

  if (!aiEnabled) {
    return "AI off · human only";
  }

  if (mode === "claimed_by_staff") {
    const control = asRecord(asRecord(metadata).control);
    const autopilot = control.ai_autopilot === true;
    if (autopilot) {
      return "Human control · AI autopilot (rare — verify policy before enabling sends)";
    }
    return "Human control · AI assist only (suggested drafts, no auto-send)";
  }

  if (mode === "waiting_for_human") {
    return aiEnabled
      ? "Waiting for a teammate · AI assist may still suggest drafts"
      : "Waiting for a teammate";
  }

  return aiEnabled
    ? "AI triage active · staff claim or reply takes human control (no pricing / approvals in auto replies)"
    : "AI triage off · claim or reply to take ownership";
}
