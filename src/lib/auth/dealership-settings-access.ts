import type { StaffRole } from "@/integrations/supabase/database.types";

/**
 * Dealership admin settings (profile, hours, routing, AI, integrations, team).
 * Advisors, BDC, and readonly staff use Inbox only — no settings access.
 */
export function canAccessDealershipAdminSettings(role: StaffRole): boolean {
  return role === "admin" || role === "manager";
}
