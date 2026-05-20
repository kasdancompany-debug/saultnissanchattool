import "server-only";

import type { TypedSupabaseClient } from "@/server/db/server-client";
import { ok, type Result } from "@/server/result";

import type { InboundNormalizedCore } from "@/server/messaging/inbound/normalized-inbound-message";

/**
 * Result of persisting one inbound customer message (duplicate = idempotent replay).
 */
export type InboundApplyResult =
  | { kind: "duplicate" }
  | {
      kind: "inserted";
      dealershipId: string;
      conversationId: string;
      messageId: string;
      createdAt: string;
      isNewConversation?: boolean;
    };

/**
 * Contract for an external messaging channel: parse → validate → normalize → {@link applyInboundMessage}.
 * Core conversation rules stay in `applyInboundMessage`; each adapter only knows its wire format + routing.
 *
 * @typeParam Parsed — Provider-specific shape after `parseWebhookPayload` (e.g. Twilio field map).
 */
export interface InboundChannelAdapter<Parsed = unknown> {
  /** Stable slug for logs and metadata (e.g. `twilio_sms`, `web_widget`). */
  readonly channelKey: string;

  /** Turn raw HTTP/body input into a typed provider payload (no auth — see validate). */
  parseWebhookPayload(raw: unknown): Result<Parsed>;

  /** Structural / semantic checks on the parsed payload (signature validation stays on the HTTP layer). */
  validateProviderRequest(parsed: Parsed): Result<void>;

  /** Map validated provider payload to the shared inbox shape (no DB). */
  normalize(parsed: Parsed): Result<InboundNormalizedCore>;

  /** Full ingest: resolve tenant/thread as needed, then {@link import("@/server/messaging/inbound/apply-inbound-message").applyInboundMessage}. */
  ingest(raw: unknown, db: TypedSupabaseClient): Promise<Result<InboundApplyResult>>;
}

/**
 * Shared parse → validate → normalize chain for tests and adapters that want a single call.
 */
export function parseValidateNormalize<Parsed>(
  adapter: InboundChannelAdapter<Parsed>,
  raw: unknown
): Result<{ parsed: Parsed; core: InboundNormalizedCore }> {
  const parsedRes = adapter.parseWebhookPayload(raw);
  if (!parsedRes.ok) {
    return parsedRes;
  }
  const valRes = adapter.validateProviderRequest(parsedRes.data);
  if (!valRes.ok) {
    return valRes;
  }
  const normRes = adapter.normalize(parsedRes.data);
  if (!normRes.ok) {
    return normRes;
  }
  return ok({ parsed: parsedRes.data, core: normRes.data });
}
