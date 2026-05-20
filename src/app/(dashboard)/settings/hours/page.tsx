import type { Metadata } from "next";

import { BusinessHoursForm } from "@/components/settings/business-hours-form";
import { SettingsReadOnlyBanner } from "@/components/settings/settings-read-only-banner";
import { SettingsSectionCard } from "@/components/settings/settings-section-card";
import { DashboardHeader } from "@/components/layout/dashboard-header";
import { parseBusinessHoursConfig } from "@/lib/business-hours/parse-config";
import { requireStaff } from "@/server/auth/staff";
import { staffCanEditDealershipSettings } from "@/server/settings/staff-privilege";

export const metadata: Metadata = {
  title: "Business hours · Settings",
};

export const dynamic = "force-dynamic";

export default async function SettingsHoursPage() {
  const staff = await requireStaff();
  const canEdit = staffCanEditDealershipSettings(staff);
  const d = staff.dealership;
  const hours = parseBusinessHoursConfig(d.business_hours, d.timezone);

  return (
    <>
      <DashboardHeader
        title="Business hours"
        description="Control when web chat is treated as live versus after-hours intake."
      />
      <main className="flex-1 space-y-3 px-4 py-4 sm:px-6 sm:py-5">
        {!canEdit ? <SettingsReadOnlyBanner /> : null}
        <SettingsSectionCard
          title="Web chat schedule"
          description="Closed days are skipped for live routing; after-hours messaging applies outside these windows."
        >
          <BusinessHoursForm initial={hours} canEdit={canEdit} />
        </SettingsSectionCard>
      </main>
    </>
  );
}
