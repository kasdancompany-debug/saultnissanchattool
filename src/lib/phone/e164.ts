/**
 * Normalizes a phone string toward E.164. Twilio typically sends fully-qualified E.164;
 * this trims and ensures a leading + when digits-only.
 */
export function normalizeE164(input: string): string {
  const trimmed = input.trim().replace(/\s/g, "");
  if (trimmed.startsWith("+")) {
    return trimmed;
  }
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length >= 10 && digits.length <= 15) {
    return `+${digits}`;
  }
  return trimmed;
}
