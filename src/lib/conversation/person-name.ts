/** Greeting or opener text — not a person's name. */
const GREETING_PREFIX_RE =
  /^(?:hi|hello|hey|yo|good\s+(?:morning|afternoon|evening)|thanks|thank\s+you)\b/i;

/** Vehicle / intent phrases commonly mis-captured as names (e.g. "Hi my car is"). */
const NON_NAME_PHRASE_RE =
  /\b(?:my\s+car|car\s+is|vehicle|truck|suv|trade(?:-|\s)?in|trade\s+in|want\s+to|looking\s+for|interested\s+in|wondering|question|help\s+with|financing|service|appointment|test\s+drive|inventory|mileage|model|year|make)\b/i;

const SENTENCE_LIKE_RE =
  /\b(?:is|are|was|were|have|has|want|need|looking|get|buy|sell|trade)\b/i;

/**
 * True when the string looks like a real person name (not a message fragment).
 */
export function isPlausiblePersonName(name: string | null | undefined): boolean {
  const n = name?.trim() ?? "";
  if (n.length < 2 || n.length > 64) {
    return false;
  }
  if (GREETING_PREFIX_RE.test(n)) {
    return false;
  }
  if (NON_NAME_PHRASE_RE.test(n)) {
    return false;
  }

  const words = n.split(/\s+/).filter(Boolean);
  if (words.length > 4) {
    return false;
  }
  if (words.length >= 3 && SENTENCE_LIKE_RE.test(n)) {
    return false;
  }

  const letters = n.replace(/[^a-zA-Z]/g, "");
  if (letters.length < 2) {
    return false;
  }

  return true;
}

export function sanitizePersonName(name: string | null | undefined): string | null {
  const trimmed = name?.trim();
  if (!trimmed) {
    return null;
  }
  return isPlausiblePersonName(trimmed) ? trimmed : null;
}
