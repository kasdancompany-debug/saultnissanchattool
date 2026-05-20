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
 * Extracts supported private **text** DM events from a Messenger (`object: page`) webhook payload.
 * Echoes, deliveries, reads, postbacks, attachment-only messages, and other shapes are skipped.
 */
export function extractMessengerInboundNormalizedMessages(
  envelope: MetaWebhookEnvelopeOk
): InboundNormalizedCore[] {
  if (envelope.object !== "page") {
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
      const normalized = tryNormalizePrivateTextMessagingEvent(ev, "messenger");
      if (normalized) {
        out.push(normalized);
      }
    }
  }
  return out;
}

export type MessengerWebhookParseResult =
  | {
      ok: true;
      summary: {
        entryCount: number;
        messagingEventCount: number;
        inboundTextMessageCount: number;
      };
      /** Normalized private text messages only (empty when batch is all non-message events). */
      messages: InboundNormalizedCore[];
    }
  | { ok: false; error: string };

/**
 * Messenger-specific handling for `object === "page"` webhooks.
 */
export function parseMessengerWebhookPayload(
  envelope: MetaWebhookEnvelopeOk
): MessengerWebhookParseResult {
  if (envelope.object !== "page") {
    return { ok: false, error: "object_not_page" };
  }

  const messages = extractMessengerInboundNormalizedMessages(envelope);
  return {
    ok: true,
    summary: {
      entryCount: envelope.entry.length,
      messagingEventCount: countMessagingEvents(envelope),
      inboundTextMessageCount: messages.length,
    },
    messages,
  };
}
