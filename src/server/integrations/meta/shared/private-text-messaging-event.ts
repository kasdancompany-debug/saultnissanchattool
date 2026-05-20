import "server-only";

import type { InboundNormalizedCore } from "@/server/messaging/inbound/normalized-inbound-message";

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function parseMessagingEpochMs(ts: unknown): string | null {
  if (typeof ts !== "number" || !Number.isFinite(ts)) {
    return null;
  }
  return new Date(ts).toISOString();
}

/**
 * Normalizes a single `entry.messaging[]` element to {@link InboundNormalizedCore}
 * when it is a **private** customer text message (not echo, not delivery/read/postback-only).
 *
 * Messenger and Instagram Graph **messaging** webhooks share this shape for standard messages.
 */
export function tryNormalizePrivateTextMessagingEvent(
  event: unknown,
  channel: "messenger" | "instagram"
): InboundNormalizedCore | null {
  if (!isRecord(event)) {
    return null;
  }

  // Ignore non-message callbacks (delivery, read, postback, opt-in, reactions, etc.).
  if (!("message" in event) || !isRecord(event.message)) {
    return null;
  }

  const msg = event.message;

  if (msg.is_echo === true) {
    return null;
  }

  const mid = msg.mid;
  if (typeof mid !== "string" || !mid.trim()) {
    return null;
  }

  const text = msg.text;
  if (typeof text !== "string" || !text.trim()) {
    return null;
  }

  const sender = event.sender;
  if (!isRecord(sender) || typeof sender.id !== "string" || !sender.id.trim()) {
    return null;
  }

  let customerDisplayName: string | undefined;
  const nameCandidate = sender.username ?? sender.user_name ?? sender.name;
  if (typeof nameCandidate === "string" && nameCandidate.trim()) {
    customerDisplayName = nameCandidate.trim();
  }

  const ts = parseMessagingEpochMs(event.timestamp);
  if (!ts) {
    return null;
  }

  let channelAccountId: string | undefined;
  const recipient = event.recipient;
  if (isRecord(recipient) && typeof recipient.id === "string" && recipient.id.trim()) {
    channelAccountId = recipient.id.trim();
  }

  return {
    externalMessageId: mid.trim(),
    channel,
    channelAccountId,
    customerHandle: sender.id.trim(),
    customerDisplayName,
    text: text.trim(),
    timestamp: ts,
    rawPayload: event,
  };
}
