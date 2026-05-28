import "server-only";

import type { StaffDepartment } from "@/integrations/supabase/database.types";
import { detectAppointmentIntent } from "@/lib/opportunity/detect-appointment-intent";
import { insertConversationEvent } from "@/server/data/conversation-events";
import { listConversationEventsForConversation } from "@/server/data/conversation-events-list";
import { resolveDb } from "@/server/data/internal";
import type { TypedSupabaseClient } from "@/server/db/server-client";

const INTENT_CONFIDENCE_THRESHOLD = 50;

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function hasIntentDetectedEvent(events: { payload: unknown }[]): boolean {
  return events.some((e) => {
    if (!isRecord(e.payload)) {
      return false;
    }
    return e.payload.kind === "appointment_intent_detected";
  });
}

async function insertIntentEvent(
  supabase: TypedSupabaseClient,
  input: {
    conversationId: string;
    actorUserId: string | null;
    payload: Record<string, unknown>;
  }
): Promise<void> {
  await insertConversationEvent(supabase, {
    conversation_id: input.conversationId,
    event_type: "metadata_changed",
    actor_user_id: input.actorUserId,
    payload: {
      kind: "appointment_intent_detected",
      ...input.payload,
    },
  });
}

/**
 * Records a single `appointment_intent_detected` timeline event per conversation
 * when customer language crosses the confidence threshold.
 */
export async function maybeRecordAppointmentIntentFromInbound(
  input: {
    dealershipId: string;
    conversationId: string;
    customerMessageBody: string;
    conversationDepartment: StaffDepartment;
  },
  db?: TypedSupabaseClient
): Promise<void> {
  const intent = detectAppointmentIntent({
    customerText: input.customerMessageBody,
    conversationDepartment: input.conversationDepartment,
  });
  if (!intent.show || intent.confidence < INTENT_CONFIDENCE_THRESHOLD) {
    return;
  }

  const supabase = await resolveDb(db);
  const existing = await listConversationEventsForConversation(
    input.dealershipId,
    input.conversationId,
    supabase
  );
  if (!existing.ok || hasIntentDetectedEvent(existing.data)) {
    return;
  }

  await insertIntentEvent(supabase, {
    conversationId: input.conversationId,
    actorUserId: null,
    payload: {
      confidence: intent.confidence,
      confidence_label: intent.confidenceLabel,
      department: intent.department,
      proposed_time_label: intent.proposedTimeLabel,
      proposed_datetime: intent.proposedDatetimeIso,
      matched_signals: intent.matchedSignals,
    },
  });
}

/** Staff acted on AI-detected intent — ensure one intent row exists before propose/confirm. */
export async function ensureAppointmentIntentEvent(
  input: {
    dealershipId: string;
    conversationId: string;
    actorUserId: string;
    department?: string | null;
  },
  db?: TypedSupabaseClient
): Promise<void> {
  const supabase = await resolveDb(db);
  const existing = await listConversationEventsForConversation(
    input.dealershipId,
    input.conversationId,
    supabase
  );
  if (!existing.ok || hasIntentDetectedEvent(existing.data)) {
    return;
  }

  await insertIntentEvent(supabase, {
    conversationId: input.conversationId,
    actorUserId: input.actorUserId,
    payload: {
      department: input.department ?? null,
      source: "staff_action",
    },
  });
}

export async function maybeRecordAppointmentIntentOnStaffAction(
  input: {
    dealershipId: string;
    conversationId: string;
    actorUserId: string;
    conversationDepartment: StaffDepartment;
    customerMessageBodies: string[];
  },
  db?: TypedSupabaseClient
): Promise<void> {
  const combined = input.customerMessageBodies.filter(Boolean).join("\n");
  if (!combined.trim()) {
    return;
  }

  const intent = detectAppointmentIntent({
    customerText: combined,
    conversationDepartment: input.conversationDepartment,
  });
  if (!intent.show || intent.confidence < INTENT_CONFIDENCE_THRESHOLD) {
    return;
  }

  const supabase = await resolveDb(db);
  const existing = await listConversationEventsForConversation(
    input.dealershipId,
    input.conversationId,
    supabase
  );
  if (!existing.ok || hasIntentDetectedEvent(existing.data)) {
    return;
  }

  await insertIntentEvent(supabase, {
    conversationId: input.conversationId,
    actorUserId: input.actorUserId,
    payload: {
      confidence: intent.confidence,
      confidence_label: intent.confidenceLabel,
      department: intent.department,
      proposed_time_label: intent.proposedTimeLabel,
      proposed_datetime: intent.proposedDatetimeIso,
      source: "staff_action",
    },
  });
}
