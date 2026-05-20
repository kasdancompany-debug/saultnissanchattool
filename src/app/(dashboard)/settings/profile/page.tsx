import type { Metadata } from "next";

import { DealershipProfileForm } from "@/components/settings/dealership-profile-form";
import { SettingsReadOnlyBanner } from "@/components/settings/settings-read-only-banner";
import { SettingsSectionCard } from "@/components/settings/settings-section-card";
import { DashboardHeader } from "@/components/layout/dashboard-header";
import { requireStaff } from "@/server/auth/staff";
import { staffCanEditDealershipSettings } from "@/server/settings/staff-privilege";

export const metadata: Metadata = {
  title: "Profile · Settings",
};

export const dynamic = "force-dynamic";

export default async function SettingsProfilePage() {
  const staff = await requireStaff();
  const canEdit = staffCanEditDealershipSettings(staff);
  const d = staff.dealership;

  return (
    <>
      <DashboardHeader
        title="Dealership profile"
        description="Display name, URL slug, and default timezone for your organization."
      />
      <main className="flex-1 space-y-3 px-4 py-4 sm:px-6 sm:py-5">
        {!canEdit ? <SettingsReadOnlyBanner /> : null}
        <SettingsSectionCard
          title="Organization"
          description="Shown in the sidebar and customer-facing surfaces when applicable."
        >
          <DealershipProfileForm
            initialName={d.name}
            initialSlug={d.slug}
            initialTimezone={d.timezone}
            canEdit={canEdit}
          />
        </SettingsSectionCard>
      </main>
    </>
  );
}
