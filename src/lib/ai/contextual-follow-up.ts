/**
 * Short, vehicle-aware follow-ups when the model would repeat itself.
 * Avoids generic loops and avoids promising handoff before staff are actually queued.
 */

const YEAR_MAKE_MODEL_RE =
  /\b(20\d{2})\s+([a-z]+)\s+([a-z0-9][a-z0-9-]*)\b/i;

const VEHICLE_PATTERNS: { re: RegExp; label: string }[] = [
  { re: /\bmazda\s+cx-?5\b/i, label: "your Mazda CX-5" },
  { re: /\btundra\b/i, label: "the Tundra" },
  { re: /\b(tacoma|4runner|highlander|rav4|camry|corolla|sienna)\b/i, label: "that Toyota" },
  { re: /\b(f-150|f150|maverick|ranger|bronco|explorer|escape)\b/i, label: "that Ford" },
  { re: /\b(silverado|sierra|colorado|tahoe|equinox|traverse)\b/i, label: "that Chevy/GMC" },
  { re: /\b(ram\s*1500|ram|1500)\b/i, label: "that Ram" },
  { re: /\b(rogue|pathfinder|murano|frontier|altima|sentra|kicks|ariya)\b/i, label: "that Nissan" },
  { re: /\b(truck|pickup)\b/i, label: "a truck" },
  { re: /\b(suv|crossover)\b/i, label: "an SUV" },
  { re: /\b(sedan|car)\b/i, label: "a vehicle" },
];

export function extractVehicleLabelFromMessage(message: string): string | null {
  const text = message.trim();
  if (!text) return null;

  const ymm = text.match(YEAR_MAKE_MODEL_RE);
  if (ymm) {
    const year = ymm[1];
    const make = ymm[2].charAt(0).toUpperCase() + ymm[2].slice(1).toLowerCase();
    const model = ymm[3]
      .split(/[- ]+/)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(" ");
    return `your ${year} ${make} ${model}`;
  }

  for (const { re, label } of VEHICLE_PATTERNS) {
    if (re.test(text)) return label;
  }
  return null;
}

export function buildContextualFollowUpFromMessage(message: string): string {
  const vehicle = extractVehicleLabelFromMessage(message);
  if (vehicle) {
    return `Got it — ${vehicle} is a great direction. Are you looking for new, used, or certified, and is there a year or trim you have in mind?`;
  }
  if (/\b(price|pricing|payment|lease|finance|apr|monthly)\b/i.test(message)) {
    return "I can help narrow that down. Which model and trim are you considering, and would you prefer to chat by text here or get a quick call from a specialist?";
  }
  if (/\b(test drive|appointment|come in|visit|today|tomorrow|can i do)\b/i.test(message)) {
    return "Absolutely — what day and time work best for you, and which vehicle should we have ready?";
  }
  if (/\b(newer|upgrade|something new|new vehicle|new car)\b/i.test(message)) {
    return "Got it — we'll focus on something newer for you. Do you prefer brand-new, certified pre-owned, or used?";
  }
  return "Thanks for the added detail. What would help most next — availability, trim options, or timing for a visit?";
}
