import type { Metadata } from "next";

import { ServiceSchedulingSettingsForm } from "@/components/settings/service-scheduling-settings-form";
import { SettingsReadOnlyBanner } from "@/components/settings/settings-read-only-banner";
import { SettingsSectionCard } from "@/components/settings/settings-section-card";
import { DashboardHeader } from "@/components/layout/dashboard-header";
import { parseDealershipSettingsV1 } from "@/lib/settings/dealership-settings-v1";
import { requireStaff } from "@/server/auth/staff";
import { staffCanEditDealershipSettings } from "@/server/settings/staff-privilege";

export const metadata: Metadata = {
  title: "Service scheduling · Settings",
};

export const dynamic = "force-dynamic";

export default async function SettingsServiceSchedulingPage() {
  const staff = await requireStaff();
  const canEdit = staffCanEditDealershipSettings(staff);
  const settings = parseDealershipSettingsV1(staff.dealership.metadata);

  return (
    <>
      <DashboardHeader
        title="Service scheduling"
        description="External booking link staff can share in service conversations."
      />
      <main className="flex-1 space-y-3 px-4 py-4 sm:px-6 sm:py-5">
        {!canEdit ? <SettingsReadOnlyBanner /> : null}
        <SettingsSectionCard
          title="External scheduler"
          description="Safe outbound deep link — customers book on your provider site."
        >
          <ServiceSchedulingSettingsForm
            initial={settings.service_scheduling}
            canEdit={canEdit}
          />
        </SettingsSectionCard>
      </main>
    </>
  );
}
