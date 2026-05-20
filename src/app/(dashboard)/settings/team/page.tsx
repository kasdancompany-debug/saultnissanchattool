import type { Metadata } from "next";

import { StaffDirectoryTable } from "@/components/settings/staff-directory-table";
import { SettingsSectionCard } from "@/components/settings/settings-section-card";
import { DashboardHeader } from "@/components/layout/dashboard-header";
import { createSupabaseServerClient } from "@/integrations/supabase/server";
import { requireStaff } from "@/server/auth/staff";
import { listStaffDirectoryByDealership } from "@/server/data/staff-users";

export const metadata: Metadata = {
  title: "Team · Settings",
};

export const dynamic = "force-dynamic";

export default async function SettingsTeamPage() {
  const staff = await requireStaff();
  const supabase = await createSupabaseServerClient();
  const staffRes = await listStaffDirectoryByDealership(staff.dealership_id, {
    db: supabase,
  });

  const rows = staffRes.ok ? staffRes.data : [];

  return (
    <>
      <DashboardHeader
        title="Team"
        description="Staff directory for your dealership. Account provisioning is handled outside this app."
      />
      <main className="flex-1 space-y-3 px-4 py-4 sm:px-6 sm:py-5">
        {!staffRes.ok ? (
          <p className="text-destructive text-sm" role="alert">
            Could not load team: {staffRes.error.message}
          </p>
        ) : (
          <SettingsSectionCard
            title="Staff"
            description="Roles control inbox access and who can edit organization settings (admins and managers)."
          >
            <StaffDirectoryTable staff={rows} />
          </SettingsSectionCard>
        )}
      </main>
    </>
  );
}
