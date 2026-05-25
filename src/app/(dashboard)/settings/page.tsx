import { redirect } from "next/navigation";

import { canAccessDealershipAdminSettings } from "@/lib/auth/dealership-settings-access";
import { requireStaff } from "@/server/auth/staff";

export default async function SettingsIndexPage() {
  const staff = await requireStaff();
  if (!canAccessDealershipAdminSettings(staff.role)) {
    redirect("/inbox?filter=mine");
  }
  redirect("/settings/profile");
}
