import type { Metadata } from "next";

import { AiPromptSettingsForm } from "@/components/settings/ai-prompt-settings-form";
import { SettingsReadOnlyBanner } from "@/components/settings/settings-read-only-banner";
import { SettingsSectionCard } from "@/components/settings/settings-section-card";
import { DashboardHeader } from "@/components/layout/dashboard-header";
import { parseDealershipSettingsV1 } from "@/lib/settings/dealership-settings-v1";
import { requireStaff } from "@/server/auth/staff";
import { staffCanEditDealershipSettings } from "@/server/settings/staff-privilege";

export const metadata: Metadata = {
  title: "AI prompts · Settings",
};

export const dynamic = "force-dynamic";

export default async function SettingsAiPage() {
  const staff = await requireStaff();
  const canEdit = staffCanEditDealershipSettings(staff);
  const settings = parseDealershipSettingsV1(staff.dealership.metadata);
  const ai = settings.ai;

  return (
    <>
      <DashboardHeader
        title="AI prompt placeholders"
        description="Dealer-specific context for future AI features — not wired to live classification yet."
      />
      <main className="flex-1 space-y-3 px-4 py-4 sm:px-6 sm:py-5">
        {!canEdit ? <SettingsReadOnlyBanner /> : null}
        <SettingsSectionCard
          title="Prompt context"
          description="Safe, non-secret text only. API keys and model configuration remain server-side."
        >
          <AiPromptSettingsForm initial={ai} canEdit={canEdit} />
        </SettingsSectionCard>
      </main>
    </>
  );
}
