import type { ConversationStatus } from "@/integrations/supabase/database.types";
import type { Json } from "@/integrations/supabase/database.types";
/** Staff-confirmed pipeline stages stored on `conversations.metadata.pipeline`. */
export type PipelineOutcomeKey = "qualified" | "appointment" | "sold" | "lost";

export type PipelineOutcomeStamp = {
  at: string;
  by: string;
  note?: string | null;
};

export type ConversationPipeline = {
  qualified?: PipelineOutcomeStamp;
  appointment?: PipelineOutcomeStamp;
  sold?: PipelineOutcomeStamp;
  lost?: PipelineOutcomeStamp;
};

export const PIPELINE_OUTCOME_LABEL: Record<PipelineOutcomeKey, string> = {
  qualified: "Qualified lead",
  appointment: "Appointment booked",
  sold: "Sold",
  lost: "Lost",
};

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function isStamp(value: unknown): value is PipelineOutcomeStamp {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const o = value as Record<string, unknown>;
  return typeof o.at === "string" && typeof o.by === "string";
}

export function readPipelineFromMetadata(metadata: unknown): ConversationPipeline {
  const raw = asRecord(asRecord(metadata).pipeline);
  const out: ConversationPipeline = {};
  if (isStamp(raw.qualified)) out.qualified = raw.qualified;
  if (isStamp(raw.appointment)) out.appointment = raw.appointment;
  if (isStamp(raw.sold)) out.sold = raw.sold;
  if (isStamp(raw.lost)) out.lost = raw.lost;
  return out;
}

export function mergePipelineOutcome(
  previous: Json,
  outcome: PipelineOutcomeKey,
  stamp: PipelineOutcomeStamp
): Json {
  const base = asRecord(previous);
  const prevPipeline = asRecord(base.pipeline);
  return {
    ...base,
    pipeline: {
      ...prevPipeline,
      [outcome]: stamp,
    },
    ...(outcome === "sold" ? { sold: true } : {}),
    ...(outcome === "lost" ? { lost: true } : {}),
  } as Json;
}

export function clearPipelineOutcome(previous: Json, outcome: PipelineOutcomeKey): Json {
  const base = asRecord(previous);
  const prevPipeline = { ...asRecord(base.pipeline) };
  delete prevPipeline[outcome];
  const next: Record<string, unknown> = {
    ...base,
    pipeline: prevPipeline,
  };
  if (outcome === "sold") {
    delete next.sold;
  }
  if (outcome === "lost") {
    delete next.lost;
  }
  return next as Json;
}

type MetricsConversationInput = {
  status: ConversationStatus;
  department: string;
  metadata: unknown;
};

/**
 * Pipeline appointment stamp (Inbox list tag / toolbar badge). War Room hero and
 * appointment metrics use confirmed rows in `appointments` — see analytics loader.
 */
export function hasAppointmentBooked(input: MetricsConversationInput): boolean {
  return Boolean(readPipelineFromMetadata(input.metadata).appointment);
}

/**
 * War room + funnel: **staff-marked** qualified lead (`metadata.pipeline.qualified`).
 */
export function isQualifiedLead(input: MetricsConversationInput): boolean {
  return Boolean(readPipelineFromMetadata(input.metadata).qualified);
}

/**
 * War room + funnel: **staff-marked** sold (`metadata.pipeline.sold` or legacy `metadata.sold`).
 */
export function isSoldVehicle(input: MetricsConversationInput): boolean {
  const pipeline = readPipelineFromMetadata(input.metadata);
  if (pipeline.sold) return true;
  return asRecord(input.metadata).sold === true;
}

export function activePipelineOutcomes(
  pipeline: ConversationPipeline
): PipelineOutcomeKey[] {
  const keys: PipelineOutcomeKey[] = [];
  if (pipeline.qualified) keys.push("qualified");
  if (pipeline.appointment) keys.push("appointment");
  if (pipeline.sold) keys.push("sold");
  if (pipeline.lost) keys.push("lost");
  return keys;
}
