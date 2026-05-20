import type { ConversationChannel } from "@/integrations/supabase/database.types";
import type { InboundProductChannel } from "@/server/messaging/inbound/normalized-inbound-message";

/**
 * Staff-facing channel for inbox UI. Extends inbound product channels with DB-only
 * values (`email`, generic `other`) that have no separate Meta / WhatsApp surface.
 */
export type InboxChannelSurfaceId = InboundProductChannel | "email" | "other";

const PRODUCT: readonly InboundProductChannel[] = [
  "web_chat",
  "sms",
  "messenger",
  "instagram",
  "whatsapp",
] as const;

function isProductChannel(value: string): value is InboundProductChannel {
  return (PRODUCT as readonly string[]).includes(value);
}

function readInboundProductChannel(metadata: unknown): InboundProductChannel | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }
  const inbound = (metadata as Record<string, unknown>).inbound;
  if (!inbound || typeof inbound !== "object" || Array.isArray(inbound)) {
    return null;
  }
  const raw = (inbound as Record<string, unknown>).product_channel;
  if (typeof raw !== "string" || !isProductChannel(raw)) {
    return null;
  }
  return raw;
}

/**
 * Infer product channel from conversation titles produced by inbound + widget flows
 * when `metadata.inbound.product_channel` is missing (legacy rows).
 */
function inferProductChannelFromTitle(title: string | null | undefined): InboundProductChannel | null {
  const t = title?.trim() ?? "";
  if (t.startsWith("Instagram —")) {
    return "instagram";
  }
  if (t.startsWith("Messenger —")) {
    return "messenger";
  }
  if (t.startsWith("WhatsApp —")) {
    return "whatsapp";
  }
  if (t.startsWith("SMS —")) {
    return "sms";
  }
  if (t.startsWith("Web —") || t.startsWith("Web chat —")) {
    return "web_chat";
  }
  return null;
}

/**
 * Resolves the channel surface shown in the inbox (list + header). Uses persisted
 * `metadata.inbound.product_channel` when present, then title heuristics, then DB `channel`.
 */
export function resolveInboxChannelSurface(input: {
  channel: ConversationChannel;
  metadata: unknown;
  title?: string | null;
}): InboxChannelSurfaceId {
  const fromMeta = readInboundProductChannel(input.metadata);
  if (fromMeta) {
    return fromMeta;
  }

  const fromTitle = inferProductChannelFromTitle(input.title);
  if (fromTitle) {
    return fromTitle;
  }

  switch (input.channel) {
    case "web_chat":
      return "web_chat";
    case "sms":
      return "sms";
    case "email":
      return "email";
    case "facebook":
      return "messenger";
    case "other":
      return "other";
  }
}

const SURFACE_LABEL: Record<InboxChannelSurfaceId, string> = {
  web_chat: "Web chat",
  sms: "SMS",
  messenger: "Messenger",
  instagram: "Instagram",
  whatsapp: "WhatsApp",
  email: "Email",
  other: "Other",
};

export function inboxChannelSurfaceLabel(surface: InboxChannelSurfaceId): string {
  return SURFACE_LABEL[surface] ?? surface;
}
