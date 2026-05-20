import type { Json } from "@/integrations/supabase/database.types";

import { DEFAULT_BUSINESS_HOURS_TORONTO } from "./defaults";
import { businessHoursConfigV1Schema } from "./schema";
import type { BusinessHoursConfigV1 } from "./types";

/**
 * Merges raw JSON from `dealerships.business_hours` with defaults.
 * Invalid or empty `{}` falls back to Toronto defaults while preserving dealership `timezone` when set.
 */
export function parseBusinessHoursConfig(
  raw: Json,
  dealershipTimezone: string
): BusinessHoursConfigV1 {
  const fallbackTz = dealershipTimezone.trim() || DEFAULT_BUSINESS_HOURS_TORONTO.timezone;

  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ...DEFAULT_BUSINESS_HOURS_TORONTO, timezone: fallbackTz };
  }

  const o = raw as Record<string, unknown>;
  if (Object.keys(o).length === 0) {
    return { ...DEFAULT_BUSINESS_HOURS_TORONTO, timezone: fallbackTz };
  }

  const withTz = {
    ...o,
    timezone:
      typeof o.timezone === "string" && o.timezone.trim().length > 0
        ? o.timezone
        : fallbackTz,
  };

  const parsed = businessHoursConfigV1Schema.safeParse(withTz);
  if (!parsed.success) {
    return { ...DEFAULT_BUSINESS_HOURS_TORONTO, timezone: fallbackTz };
  }

  return parsed.data;
}
