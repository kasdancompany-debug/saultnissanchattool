import {
  aggregateProfileHintsFromTexts,
  isPlaceholderCustomerName,
  type ExtractedProfileHints,
} from "@/lib/conversation/extract-profile-hints";
import { normalizeE164 } from "@/lib/phone/e164";

export type EffectiveCustomerProfile = {
  displayName: string;
  email: string | null;
  phoneE164: string | null;
  extractedFromChat: ExtractedProfileHints;
};

export type ResolveEffectiveCustomerProfileInput = {
  displayName: string;
  email: string | null | undefined;
  phoneE164: string | null | undefined;
  customerMessageBodies: string[];
  aiInsightsProfile?: {
    name: string | null;
    email: string | null;
    phone_e164: string | null;
  } | null;
};

function normalizePhoneForDisplay(
  phone: string | null | undefined
): string | null {
  const raw = phone?.trim();
  if (!raw) return null;
  const normalized = normalizeE164(raw);
  return normalized.startsWith("+") ? normalized : raw;
}

/**
 * Single source of truth for customer name/phone/email shown in Inbox profile + Insights.
 * Prefers chat extraction, then CRM row, then AI insights snapshot on the conversation.
 */
export function resolveEffectiveCustomerProfile(
  input: ResolveEffectiveCustomerProfileInput
): EffectiveCustomerProfile {
  const extractedFromChat = aggregateProfileHintsFromTexts(
    input.customerMessageBodies
  );

  const fromAi: ExtractedProfileHints = {
    name: input.aiInsightsProfile?.name?.trim() ?? null,
    email: input.aiInsightsProfile?.email?.trim() ?? null,
    phoneE164: normalizePhoneForDisplay(
      input.aiInsightsProfile?.phone_e164
    ),
  };

  const extracted: ExtractedProfileHints = {
    name: extractedFromChat.name ?? fromAi.name,
    email: extractedFromChat.email ?? fromAi.email,
    phoneE164: extractedFromChat.phoneE164 ?? fromAi.phoneE164,
  };

  const effectiveDisplayName =
    extracted.name?.trim() ||
    (!isPlaceholderCustomerName(input.displayName)
      ? input.displayName.trim()
      : null) ||
    input.displayName.trim() ||
    "Unknown customer";

  const effectivePhoneE164 =
    extracted.phoneE164?.trim() ||
    normalizePhoneForDisplay(input.phoneE164) ||
    null;

  const effectiveEmail =
    extracted.email?.trim() ||
    input.email?.trim() ||
    null;

  return {
    displayName: effectiveDisplayName,
    email: effectiveEmail,
    phoneE164: effectivePhoneE164,
    extractedFromChat: extracted,
  };
}
