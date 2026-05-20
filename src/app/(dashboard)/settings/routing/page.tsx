import type { Metadata } from "next";

import { RoutingSettingsForm } from "@/components/settings/routing-settings-form";
import { SettingsReadOnlyBanner } from "@/components/settings/settings-read-only-banner";
import { SettingsSectionCard } from "@/components/settings/settings-section-card";
import { DashboardHeader } from "@/components/layout/dashboard-header";
import { parseDealershipSettingsV1 } from "@/lib/settings/dealership-settings-v1";
import { requireStaff } from "@/server/auth/staff";
import { staffCanEditDealershipSettings } from "@/server/settings/staff-privilege";

export const metadata: Metadata = {
  title: "Routing · Settings",
};

export const dynamic = "force-dynamic";

export default async function SettingsRoutingPage() {
  const staff = await requireStaff();
  const canEdit = staffCanEditDealershipSettings(staff);
  const settings = parseDealershipSettingsV1(staff.dealership.metadata);
  const routing = settings.routing;

  return (
    <>
      <DashboardHeader
        title="Routing"
        description="Defaults and notes for how conversations are routed as automation grows."
      />
      <main className="flex-1 space-y-3 px-4 py-4 sm:px-6 sm:py-5">
        {!canEdit ? <SettingsReadOnlyBanner /> : null}
        <SettingsSectionCard
          title="Intake routing"
          description="Structured for future rules engine expansion (skills, territories, VIP)."
        >
          <RoutingSettingsForm initial={routing} canEdit={canEdit} />
        </SettingsSectionCard>
      </main>
    </>
  );
}
