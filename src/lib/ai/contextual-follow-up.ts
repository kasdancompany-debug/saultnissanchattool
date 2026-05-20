/**
 * Short, vehicle-aware follow-ups when the model would repeat itself.
 * Avoids generic loops and avoids promising handoff before staff are actually queued.
 */

const VEHICLE_PATTERNS: { re: RegExp; label: string }[] = [
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
  if (/\b(test drive|appointment|come in|visit|today|tomorrow)\b/i.test(message)) {
    return "Absolutely — what day and time work best for you, and which vehicle should we have ready?";
  }
  return "Thanks for the added detail. What would help most next — availability, trim options, or timing for a visit?";
}
