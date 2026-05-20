import type { Json } from "@/integrations/supabase/database.types";

/**
 * Provider-agnostic missed-call signal. Map any telephony webhook payload into this shape
 * before handing off to `handleMissedCallEvent` (see `missed-call-service.ts`).
 */
export type NormalizedMissedCallEvent = {
  /**
   * Logical integration id (e.g. `twilio_voice`, `bandwidth_voice`, `generic_http`).
   * Stored on conversation metadata for auditing — not tied to a single vendor.
   */
  provider: string;
  /** Caller number, E.164 preferred. */
  callerE164: string;
  /**
   * Our dealership line that was called (E.164), used to resolve `dealership_id`
   * when `dealershipId` is omitted.
   */
  dialedE164?: string | null;
  /** When known, skips lookup by `dialedE164`. */
  dealershipId?: string | null;
  /**
   * Stable id from the call provider for idempotency (duplicate webhook retries).
   */
  externalCallId?: string | null;
  /** Optional small audit blob (truncated before persistence if large). */
  raw?: Json | Record<string, unknown> | null;
};

export type MissedCallFlowState = {
  phase: "awaiting_department" | "routed";
  provider?: string;
  last_external_call_id?: string;
  started_at?: string;
  routed_department?: string;
  routed_at?: string;
};
