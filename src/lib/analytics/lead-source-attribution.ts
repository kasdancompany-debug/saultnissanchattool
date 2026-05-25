import type { ConversationChannel } from "@/integrations/supabase/database.types";
import { resolveInboxChannelSurface } from "@/lib/conversation/inbox-channel-surface";

export type LeadSourceKey =
  | "website"
  | "sms"
  | "facebook"
  | "instagram"
  | "google_ads"
  | "organic";

export type LeadSourceConversationInput = {
  channel: ConversationChannel;
  metadata: unknown;
  title?: string | null;
};

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

/** Paid search / Google Ads click identifiers on the thread metadata. */
export function isGoogleAdsAttribution(metadata: unknown): boolean {
  const blob = JSON.stringify(metadata).toLowerCase();
  return (
    /gclid|utm_source=google|google_ads|utm_medium=cpc|utm_medium=ppc|utm_campaign=/.test(
      blob
    )
  );
}

/** Organic search referrer or explicit organic UTM — not “unknown” widget traffic. */
export function isOrganicSearchAttribution(metadata: unknown): boolean {
  const meta = asRecord(metadata);
  const widget = asRecord(meta.widget);
  const utm = asRecord(widget.utm ?? meta.utm);
  const utmSource = String(utm.source ?? utm.utm_source ?? "").toLowerCase();
  const utmMedium = String(utm.medium ?? utm.utm_medium ?? "").toLowerCase();
  if (utmMedium === "organic" || utmSource === "organic") {
    return true;
  }

  const ref = String(widget.referrer ?? meta.referrer ?? "").toLowerCase();
  if (!ref || /direct|none|\(not set\)/i.test(ref)) {
    return false;
  }
  if (/gclid|googleads|ads\.|utm_medium=cpc|utm_medium=ppc/.test(ref)) {
    return false;
  }
  return /google\.|bing\.|yahoo\.|duckduckgo\.|ecosia\.|search\./.test(ref);
}

/**
 * Maps a conversation to a single lead-source bucket for executive attribution.
 * Web widget threads default to Website; Organic requires explicit search/UTM signals.
 */
export function classifyLeadSource(input: LeadSourceConversationInput): LeadSourceKey {
  const surface = resolveInboxChannelSurface({
    channel: input.channel,
    metadata: input.metadata,
    title: input.title,
  });

  if (surface === "sms") return "sms";
  if (surface === "instagram") return "instagram";
  if (surface === "messenger") return "facebook";

  if (surface === "web_chat" || input.channel === "web_chat") {
    if (isGoogleAdsAttribution(input.metadata)) return "google_ads";
    if (isOrganicSearchAttribution(input.metadata)) return "organic";
    return "website";
  }

  if (input.channel === "facebook") return "facebook";
  return "website";
}
