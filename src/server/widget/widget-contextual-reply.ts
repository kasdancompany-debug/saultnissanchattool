import "server-only";

import type { ExtractedProfileHints } from "@/lib/conversation/extract-profile-hints";
import { isPlaceholderCustomerName } from "@/lib/conversation/extract-profile-hints";

export type WidgetReplyContext = {
  customerMessage: string;
  /** All customer message bodies in the thread (for intent across turns). */
  threadText: string;
  department: string;
  topic: string | null;
  hints: ExtractedProfileHints;
  missingAfterHints: string[];
  knownDisplayName?: string | null;
  knownPhoneE164?: string | null;
  lastAssistantMessage?: string | null;
};

function firstName(name: string | null | undefined): string | null {
  const n = name?.trim();
  if (!n) return null;
  return n.split(/\s+/)[0] ?? null;
}

function formatPhoneForDisplay(phoneE164: string | null | undefined): string | null {
  const raw = phoneE164?.trim();
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) {
    const d = digits.slice(1);
    return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return raw;
}

function topicLabel(topic: string | null, department: string): string {
  if (topic) {
    return topic.replace(/_/g, " ");
  }
  if (department === "sales") return "sales";
  if (department === "service") return "service";
  return "your visit";
}

function wantsAppointment(text: string): boolean {
  return /\b(appointment|book(?:ing)?|schedule|test drive|come in|visit)\b/i.test(
    text
  );
}

function mentionsVehicleOrService(text: string): boolean {
  return /\b(vehicle|car|truck|suv|oil|tire|brake|service|trade|financ)\b/i.test(
    text
  );
}

function isFollowUpMessage(text: string): boolean {
  return /\b(follow[- ]?up|checking in|check in|any update|update\??|heard back|status|still waiting|waiting for|call me back)\b/i.test(
    text
  );
}

function isGratitude(text: string): boolean {
  return /^\s*(thanks|thank you|thx|ty|appreciate it)\s*[!.?]*\s*$/i.test(text);
}

function wantsHuman(text: string): boolean {
  return /\b(speak to|talk to|real person|human|agent|representative|manager)\b/i.test(
    text
  );
}

function lastAssistantAskedForContact(lastAssistant: string | null | undefined): boolean {
  if (!lastAssistant?.trim()) return false;
  return /\b(name and phone|phone number|best number|reach you|follow up with you)\b/i.test(
    lastAssistant
  );
}

function resolveEffectiveContact(ctx: WidgetReplyContext): {
  name: string | null;
  phoneE164: string | null;
  first: string | null;
  phoneDisplay: string | null;
  hasName: boolean;
  hasPhone: boolean;
  contactComplete: boolean;
} {
  const name =
    ctx.hints.name?.trim() ||
    (!isPlaceholderCustomerName(ctx.knownDisplayName)
      ? ctx.knownDisplayName?.trim() ?? null
      : null);
  const phoneE164 = ctx.hints.phoneE164?.trim() || ctx.knownPhoneE164?.trim() || null;
  const first = firstName(name);
  const phoneDisplay = formatPhoneForDisplay(phoneE164);
  const hasName = Boolean(name);
  const hasPhone = Boolean(phoneE164);
  const contactComplete = ctx.missingAfterHints.length === 0;
  return { name, phoneE164, first, phoneDisplay, hasName, hasPhone, contactComplete };
}

/**
 * Customer-facing reply when the LLM is unavailable or returns invalid JSON.
 * Uses the full thread + saved customer profile — not only the latest line.
 */
export function buildContextualWidgetReply(ctx: WidgetReplyContext): string {
  const text = ctx.customerMessage.trim();
  const thread = ctx.threadText.trim();
  const combined = `${thread}\n${text}`.trim();
  const topic = topicLabel(ctx.topic, ctx.department);
  const contact = resolveEffectiveContact(ctx);
  const { first, phoneDisplay, hasName, hasPhone, contactComplete } = contact;

  if (wantsHuman(text)) {
    return contact.hasName
      ? `${first ? `${first}, ` : ""}a teammate will join this thread as soon as someone is available. We've got your details on file.`
      : "I can connect you with our team — what's the best name and phone number to reach you?";
  }

  if (contactComplete) {
    const greet = first ? first : "there";

    if (isGratitude(text)) {
      return `You're welcome${first ? `, ${first}` : ""}. If anything else comes up about your ${topic} request, just send it here.`;
    }

    if (
      isFollowUpMessage(text) ||
      (lastAssistantAskedForContact(ctx.lastAssistantMessage) &&
        text.length < 80)
    ) {
      return `Hi ${greet} — we have your contact info${phoneDisplay ? ` (${phoneDisplay})` : ""}. Our team will follow up on your ${topic} request; if you have a preferred day or time, share it here and we'll note it.`;
    }

    if (wantsAppointment(combined) && !wantsAppointment(ctx.lastAssistantMessage ?? "")) {
      return `Thanks${first ? `, ${first}` : ""}. What day and time work best for your ${topic} appointment? We'll confirm with you shortly.`;
    }

    if (mentionsVehicleOrService(text) || mentionsVehicleOrService(thread)) {
      return `Got it${first ? `, ${first}` : ""} — thanks for those details. A teammate will pick this up for ${topic}. Anything else we should pass along (timing, vehicle, or service need)?`;
    }

    return `Thanks${first ? `, ${first}` : ""} — we have what we need to reach you. What would you like help with next on ${topic}?`;
  }

  if (hasName && hasPhone) {
    const greet = first ? `Thanks, ${first}` : "Thanks";
    if (wantsAppointment(combined)) {
      return `${greet} — we've got your number${phoneDisplay ? ` (${phoneDisplay})` : ""}. What day or time works best for your ${topic} appointment? Our team will confirm shortly.`;
    }
    if (mentionsVehicleOrService(combined)) {
      return `${greet} — thanks for the details. A teammate will follow up on your ${topic} request soon. Anything else we should note (preferred day/time or vehicle)?`;
    }
    return `${greet} — we've saved your contact info. What would you like help with for ${topic} today?`;
  }

  if (hasName && !hasPhone) {
    const greet = first ? `Thanks, ${first}` : "Thanks";
    return `${greet}. What's the best phone number for our team to reach you?`;
  }

  if (hasPhone && !hasName) {
    return `Thanks — we've noted your number${phoneDisplay ? ` (${phoneDisplay})` : ""}. What's your name so we can personalize your ${topic} follow-up?`;
  }

  if (wantsAppointment(combined)) {
    return `We can help with a ${topic} appointment. What's the best name and phone number for our team to confirm a time with you?`;
  }

  if (mentionsVehicleOrService(combined)) {
    return `Thanks for sharing that. What's the best name and phone number so our team can follow up on your ${topic} question?`;
  }

  const missing = ctx.missingAfterHints;
  if (missing.includes("phone") && !missing.includes("name")) {
    return "Thanks for reaching out. What's the best phone number for our team to call or text you back?";
  }
  if (missing.includes("name") && !missing.includes("phone")) {
    return "Thanks for reaching out. What's your name, and the best phone number for our team to follow up?";
  }

  return "Thanks for reaching out. What's the best name and phone number for our team to follow up with you?";
}

/** Parse model output that may include markdown fences or extra prose. */
export function parseWidgetReplyJson(content: string): string | null {
  const trimmed = content.trim();
  if (!trimmed) return null;

  const tryParse = (raw: string): string | null => {
    try {
      const obj = JSON.parse(raw) as { reply?: unknown };
      if (typeof obj.reply === "string" && obj.reply.trim()) {
        return obj.reply.trim();
      }
    } catch {
      return null;
    }
    return null;
  };

  const direct = tryParse(trimmed);
  if (direct) return direct;

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    const fromFence = tryParse(fenced[1].trim());
    if (fromFence) return fromFence;
  }

  const brace = trimmed.match(/\{[\s\S]*\}/);
  if (brace?.[0]) {
    return tryParse(brace[0]);
  }

  return null;
}
