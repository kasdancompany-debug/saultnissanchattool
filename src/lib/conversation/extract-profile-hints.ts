import { normalizeE164 } from "@/lib/phone/e164";

const EMAIL_IN_TEXT_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
const PHONE_HINT_RE = /(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?){2}\d{4}\b/;
const NAME_PATTERNS = [
  /\b(?:my name is|i am|i'm|im|this is)\s+([a-z][a-z' -]{1,60})\b/i,
  /\b(?:^|\n)([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})\s+here\b/,
];

export type ExtractedProfileHints = {
  name: string | null;
  email: string | null;
  phoneE164: string | null;
};

export function extractProfileHintsFromText(text: string): ExtractedProfileHints {
  const trimmed = text.trim();
  const emailMatch = trimmed.match(EMAIL_IN_TEXT_RE);
  const phoneMatch = trimmed.match(PHONE_HINT_RE);

  let name: string | null = null;
  for (const re of NAME_PATTERNS) {
    const m = trimmed.match(re);
    const raw = m?.[1]?.trim() ?? "";
    if (raw.length >= 2 && raw.length <= 120) {
      name = raw;
      break;
    }
  }

  const email = emailMatch ? emailMatch[0].toLowerCase() : null;
  const phoneE164 = phoneMatch ? normalizeE164(phoneMatch[0]) || null : null;

  return { name, email, phoneE164 };
}

const PLACEHOLDER_NAMES = new Set([
  "website visitor",
  "visitor",
  "guest",
  "unknown",
]);

export function isPlaceholderCustomerName(name: string | null | undefined): boolean {
  const n = name?.trim().toLowerCase() ?? "";
  return n.length === 0 || PLACEHOLDER_NAMES.has(n);
}

export function mergeExtractedCustomerProfile(input: {
  fromModel: ExtractedProfileHints;
  fromHeuristics: ExtractedProfileHints;
}): ExtractedProfileHints {
  return {
    name: input.fromModel.name ?? input.fromHeuristics.name,
    email: input.fromModel.email ?? input.fromHeuristics.email,
    phoneE164: input.fromModel.phoneE164 ?? input.fromHeuristics.phoneE164,
  };
}

export function profileFieldsStillMissing(input: {
  displayName: string | null | undefined;
  email: string | null | undefined;
  phoneE164: string | null | undefined;
  extracted: ExtractedProfileHints;
}): string[] {
  const hasName =
    !isPlaceholderCustomerName(input.displayName) ||
    Boolean(input.extracted.name?.trim());
  const hasEmail = Boolean(input.email?.trim() || input.extracted.email);
  const hasPhone = Boolean(input.phoneE164?.trim() || input.extracted.phoneE164);
  return [
    ...(hasName ? [] : ["name"]),
    ...(hasPhone ? [] : ["phone"]),
    ...(hasEmail ? [] : ["email"]),
  ];
}
