import type { StaffDepartment } from "@/integrations/supabase/database.types";

/**
 * Mirrors server widget routing — used client-side for live-hours evaluation
 * before a conversation exists.
 */
export function inferDepartmentFromPagePath(
  pagePath: string | null | undefined
): StaffDepartment {
  if (!pagePath) {
    return "general";
  }
  const p = pagePath.toLowerCase();
  if (p.includes("/service") || p.includes("service")) {
    return "service";
  }
  if (
    p.includes("/sales") ||
    p.includes("inventory") ||
    p.includes("vehicle") ||
    p.includes("/new") ||
    p.includes("/used")
  ) {
    return "sales";
  }
  if (p.includes("/parts")) {
    return "parts";
  }
  if (p.includes("bdc") || p.includes("contact")) {
    return "bdc";
  }
  return "general";
}
