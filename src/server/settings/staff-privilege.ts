import "server-only";

import { canAccessDealershipAdminSettings } from "@/lib/auth/dealership-settings-access";
import type { CurrentStaff } from "@/server/auth/staff";

/** Matches `current_staff_is_privileged()` in Postgres RLS for dealership updates. */
export function staffCanEditDealershipSettings(staff: CurrentStaff): boolean {
  return canAccessDealershipAdminSettings(staff.role);
}
