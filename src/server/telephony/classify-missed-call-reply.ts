import type { StaffDepartment } from "@/integrations/supabase/database.types";

const SALES = /\b(sales|sale|buy|buying|vehicle|vehicles|car|cars|truck|suv|inventory|new|used|price|pricing)\b/i;
const SERVICE = /\b(service|repair|repairs|maintenance|oil|tire|tires|warranty|recall|appointment|schedule)\b/i;
const PARTS = /\b(parts|part|accessory|accessories|oem)\b/i;

/**
 * Maps a free-text SMS reply to Sales / Service / Parts for inbox routing.
 * Returns `null` when nothing matches (stay in awaiting_department).
 */
export function classifyMissedCallDepartmentReply(
  body: string
): Extract<StaffDepartment, "sales" | "service" | "parts"> | null {
  const t = body.trim();
  if (!t) {
    return null;
  }

  const scores = {
    sales: score(t, SALES),
    service: score(t, SERVICE),
    parts: score(t, PARTS),
  };

  const max = Math.max(scores.sales, scores.service, scores.parts);
  if (max === 0) {
    return null;
  }

  if (scores.sales === max && scores.sales > 0) {
    return "sales";
  }
  if (scores.service === max && scores.service > 0) {
    return "service";
  }
  if (scores.parts === max && scores.parts > 0) {
    return "parts";
  }

  return null;
}

function score(text: string, re: RegExp): number {
  return re.test(text) ? 1 : 0;
}
