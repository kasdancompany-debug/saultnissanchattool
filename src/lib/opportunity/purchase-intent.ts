/**
 * Shared purchase-intent detection for inbox scoring and tags.
 * Tuned for dealership triage: layups vs tire-kickers.
 */

/** "I want a new car", "looking for a used truck", "in the market for an SUV", etc. */
export const VEHICLE_PURCHASE_RE =
  /\b(?:want\s+(?:a|the|to\s+get)\s+(?:new|used|pre[- ]?owned)?\s*(?:car|cars|truck|trucks|suv|vehicle|nissan|rogue|sentra|frontier|kicks|pathfinder|altima|murano)|want\s+(?:a\s+)?new\s+(?:car|truck|suv|vehicle)|want\s+to\s+(?:buy|purchase|get|lease)(?:\s+a|\s+the)?\s*(?:new|used|car|truck|suv|vehicle)?|looking\s+for\s+(?:a\s+)?(?:new|used|pre[- ]?owned)?\s*(?:car|truck|suv|vehicle)|in\s+the\s+market\s+for|need\s+(?:a\s+)?(?:new|used)?\s*(?:car|truck|suv|vehicle)|shopping\s+for\s+(?:a\s+)?(?:new|used)?\s*(?:car|truck|vehicle)|interested\s+in\s+(?:buying|a\s+new|a\s+used|getting))\b/i;

/** Low-commitment browsing — only dampens score when purchase signals are absent. */
export const TIRE_KICKER_RE =
  /\b(?:just\s+(?:looking|browsing|window\s+shopping)|maybe\s+later|not\s+(?:ready|sure)|no\s+rush|someday|curious\s+only|kicking\s+tires?)\b/i;

export const WIDGET_PURCHASE_INTENTS = new Set([
  "new_vehicle",
  "used_vehicle",
  "trade_value",
  "financing",
]);

export function hasVehiclePurchaseIntent(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  return VEHICLE_PURCHASE_RE.test(t);
}

export function hasTireKickerLanguage(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  return TIRE_KICKER_RE.test(t);
}

export function isWidgetPurchaseIntent(intent: string | null | undefined): boolean {
  const key = intent?.trim();
  return Boolean(key && WIDGET_PURCHASE_INTENTS.has(key));
}
