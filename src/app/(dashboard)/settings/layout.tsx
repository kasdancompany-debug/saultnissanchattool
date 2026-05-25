import { redirect } from "next/navigation";

import { SettingsSidebar } from "@/components/settings/settings-sidebar";
import { canAccessDealershipAdminSettings } from "@/lib/auth/dealership-settings-access";
import { requireStaff } from "@/server/auth/staff";

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const staff = await requireStaff();

  if (!canAccessDealershipAdminSettings(staff.role)) {
    redirect("/inbox?filter=mine");
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1">
      <SettingsSidebar />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
