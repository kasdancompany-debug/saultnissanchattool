/**
 * Normalizes a phone string toward E.164. Twilio typically sends fully-qualified E.164;
 * this trims and ensures a leading + when digits-only.
 * North American 10-digit numbers (e.g. 705-206-3669) become +1XXXXXXXXXX.
 */
export function normalizeE164(input: string): string {
  const trimmed = input.trim().replace(/\s/g, "");
  const digits = trimmed.replace(/\D/g, "");

  if (trimmed.startsWith("+")) {
    const afterPlus = trimmed.slice(1).replace(/\D/g, "");
    if (afterPlus.length === 10 && /^[2-9]/.test(afterPlus)) {
      return `+1${afterPlus}`;
    }
    return `+${afterPlus}`;
  }

  if (digits.length === 10 && /^[2-9]/.test(digits)) {
    return `+1${digits}`;
  }
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+${digits}`;
  }
  if (digits.length >= 10 && digits.length <= 15) {
    return `+${digits}`;
  }
  return trimmed;
}

/** Variants that may exist in CRM from older normalization (e.g. +705… vs +1705…). */
export function phoneLookupVariants(phone: string): string[] {
  const primary = normalizeE164(phone);
  const variants = new Set<string>([primary]);
  if (primary.startsWith("+1") && primary.length === 12) {
    variants.add(`+${primary.slice(2)}`);
  }
  const digits = primary.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) {
    variants.add(`+${digits.slice(1)}`);
  }
  return [...variants];
}

export function phonesEquivalent(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = a?.trim();
  const nb = b?.trim();
  if (!na && !nb) return true;
  if (!na || !nb) return false;
  return normalizeE164(na) === normalizeE164(nb);
}
