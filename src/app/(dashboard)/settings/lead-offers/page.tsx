import type { Metadata } from "next";

import { LeadOffersSettings } from "@/components/settings/lead-offers-settings";
import { SettingsReadOnlyBanner } from "@/components/settings/settings-read-only-banner";
import { SettingsSectionCard } from "@/components/settings/settings-section-card";
import { DashboardHeader } from "@/components/layout/dashboard-header";
import { requireStaff } from "@/server/auth/staff";
import { listLeadOffersForDealership } from "@/server/data/lead-offers";
import { staffCanEditDealershipSettings } from "@/server/settings/staff-privilege";

export const metadata: Metadata = {
  title: "Lead offers · Settings",
};

export const dynamic = "force-dynamic";

export default async function SettingsLeadOffersPage() {
  const staff = await requireStaff();
  const canEdit = staffCanEditDealershipSettings(staff);
  const offersRes = await listLeadOffersForDealership(staff.dealership_id);
  const offers = offersRes.ok ? offersRes.data : [];

  return (
    <>
      <DashboardHeader
        title="Lead offers"
        description="Promotions the AI can mention naturally in web chat — helpful tone, never pushy."
      />
      <main className="flex-1 space-y-3 px-4 py-4 sm:px-6 sm:py-5">
        {!canEdit ? <SettingsReadOnlyBanner /> : null}
        <SettingsSectionCard
          title="Offers"
          description="Active offers within their date range are available to the AI for matching departments."
        >
          <LeadOffersSettings offers={offers} canEdit={canEdit} />
        </SettingsSectionCard>
      </main>
    </>
  );
}
