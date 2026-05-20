import "server-only";

import type { MetaWebhookEnvelopeOk } from "@/server/integrations/meta/parse-envelope";
import { tryNormalizePrivateTextMessagingEvent } from "@/server/integrations/meta/shared/private-text-messaging-event";
import type { InboundNormalizedCore } from "@/server/messaging/inbound/normalized-inbound-message";

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function countMessagingEvents(envelope: MetaWebhookEnvelopeOk): number {
  let n = 0;
  for (const item of envelope.entry) {
    if (!isRecord(item)) {
      continue;
    }
    const messaging = item.messaging;
    if (Array.isArray(messaging)) {
      n += messaging.length;
    }
  }
  return n;
}

/**
 * Counts `changes` entries for diagnostics only. **Not** used for DM ingestion — public comments
 * and other change types must not be treated as private conversations here.
 */
function countChangesEvents(envelope: MetaWebhookEnvelopeOk): number {
  let n = 0;
  for (const item of envelope.entry) {
    if (!isRecord(item)) {
      continue;
    }
    const changes = item.changes;
    if (Array.isArray(changes)) {
      n += changes.length;
    }
  }
  return n;
}

/**
 * Extracts supported private **text** DM events from an Instagram (`object: instagram`) webhook.
 * Only `entry[].messaging` is considered. `entry[].changes` (e.g. comments) is ignored.
 */
export function extractInstagramInboundNormalizedMessages(
  envelope: MetaWebhookEnvelopeOk
): InboundNormalizedCore[] {
  if (envelope.object !== "instagram") {
    return [];
  }

  const out: InboundNormalizedCore[] = [];
  for (const item of envelope.entry) {
    if (!isRecord(item)) {
      continue;
    }
    const messaging = item.messaging;
    if (!Array.isArray(messaging)) {
      continue;
    }
    for (const ev of messaging) {
      const normalized = tryNormalizePrivateTextMessagingEvent(ev, "instagram");
      if (normalized) {
        out.push(normalized);
      }
    }
  }
  return out;
}

export type InstagramWebhookParseResult =
  | {
      ok: true;
      summary: {
        entryCount: number;
        messagingEventCount: number;
        /** Present for observability; not parsed into inbox messages. */
        changesEventCount: number;
        inboundTextMessageCount: number;
      };
      messages: InboundNormalizedCore[];
    }
  | { ok: false; error: string };

/**
 * Instagram-specific handling for `object === "instagram"` webhooks (DMs via messaging only).
 */
export function parseInstagramWebhookPayload(
  envelope: MetaWebhookEnvelopeOk
): InstagramWebhookParseResult {
  if (envelope.object !== "instagram") {
    return { ok: false, error: "object_not_instagram" };
  }

  const messages = extractInstagramInboundNormalizedMessages(envelope);
  return {
    ok: true,
    summary: {
      entryCount: envelope.entry.length,
      messagingEventCount: countMessagingEvents(envelope),
      changesEventCount: countChangesEvents(envelope),
      inboundTextMessageCount: messages.length,
    },
    messages,
  };
}
