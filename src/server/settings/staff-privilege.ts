import "server-only";

import type { CurrentStaff } from "@/server/auth/staff";

/** Matches `current_staff_is_privileged()` in Postgres RLS for dealership updates. */
export function staffCanEditDealershipSettings(staff: CurrentStaff): boolean {
  return staff.role === "admin" || staff.role === "manager";
}
