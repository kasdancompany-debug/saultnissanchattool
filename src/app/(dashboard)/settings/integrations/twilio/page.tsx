import type { Metadata } from "next";

import { ChannelAccountsSettingsTable } from "@/components/settings/channel-accounts-settings-table";
import { IntegrationStatusRow } from "@/components/settings/integration-status-row";
import { IntegrationsSecretsCallout } from "@/components/settings/integrations-secrets-callout";
import { IntegrationsSettingsShell } from "@/components/settings/integrations-settings-shell";
import { SettingsReadOnlyBanner } from "@/components/settings/settings-read-only-banner";
import { SettingsSectionCard } from "@/components/settings/settings-section-card";
import { TwilioSettingsForm } from "@/components/settings/twilio-settings-form";
import { createSupabaseServerClient } from "@/integrations/supabase/server";
import { parseDealershipSettingsV1 } from "@/lib/settings/dealership-settings-v1";
import { DEALERSHIP_CHANNEL_PROVIDER } from "@/server/data/dealership-channel-accounts";
import { requireStaff } from "@/server/auth/staff";
import {
  countActiveTwilioSmsLines,
  filterAccountsByProviders,
  loadIntegrationsDashboardData,
} from "@/server/settings/integrations-load";
import { staffCanEditDealershipSettings } from "@/server/settings/staff-privilege";

export const metadata: Metadata = {
  title: "Twilio · Integrations",
};

export const dynamic = "force-dynamic";

export default async function IntegrationsTwilioPage() {
  const staff = await requireStaff();
  const canEdit = staffCanEditDealershipSettings(staff);
  const settings = parseDealershipSettingsV1(staff.dealership.metadata);
  const twilioMeta = settings.twilio;

  const supabase = await createSupabaseServerClient();
  const loaded = await loadIntegrationsDashboardData(
    staff.dealership_id,
    staff.dealership.twilio_phone_e164,
    supabase
  );

  const data = loaded.ok ? loaded.data : null;
  const twilioRows = data
    ? filterAccountsByProviders(data.channelAccounts, [DEALERSHIP_CHANNEL_PROVIDER.TWILIO_SMS])
    : [];
  const activeSms = data ? countActiveTwilioSmsLines(data.channelAccounts) : 0;
  const legacy = data?.legacyTwilioPhoneE164?.trim() || null;

  return (
    <IntegrationsSettingsShell
      title="Twilio"
      description="SMS routing identifiers and dealership-facing number. Server credentials are never shown."
    >
      <main className="flex-1 space-y-4 px-4 py-4 sm:px-6 sm:py-5">
        {!canEdit ? <SettingsReadOnlyBanner /> : null}

        {!loaded.ok ? (
          <p className="text-destructive text-sm" role="alert">
            Could not load channel accounts ({loaded.error.message}).
          </p>
        ) : null}

        <IntegrationsSecretsCallout />

        <SettingsSectionCard
          title="Connection status"
          description="High-level readiness from environment and channel rows."
        >
          <IntegrationStatusRow
            label="Twilio REST credentials (server)"
            value={data?.twilioServerEnvConfigured ? "Present" : "Missing"}
            tone={data?.twilioServerEnvConfigured ? "positive" : "caution"}
          />
          <IntegrationStatusRow
            label="Inbound SMS routing"
            value={
              activeSms > 0
                ? `${activeSms} active line${activeSms === 1 ? "" : "s"} in channel accounts`
                : legacy
                  ? "Legacy dealership number on file"
                  : "No active Twilio SMS line"
            }
            tone={activeSms > 0 || legacy ? "positive" : "caution"}
          />
        </SettingsSectionCard>

        <SettingsSectionCard
          title="Twilio SMS channel accounts"
          description="Each row is an E.164 that can receive inbound SMS for this dealership."
        >
          <ChannelAccountsSettingsTable
            rows={twilioRows}
            emptyHint="No Twilio SMS channel rows yet. Add active `twilio_sms` rows in dealership_channel_accounts (or set the legacy dealership number below) so inbound SMS can route to the inbox."
          />
        </SettingsSectionCard>

        <SettingsSectionCard
          title="Dealership SMS number & notes"
          description="Public fields stored on the dealership record."
        >
          <TwilioSettingsForm
            initialPhoneE164={staff.dealership.twilio_phone_e164}
            initialTwilioMeta={twilioMeta}
            canEdit={canEdit}
          />
        </SettingsSectionCard>
      </main>
    </IntegrationsSettingsShell>
  );
}
