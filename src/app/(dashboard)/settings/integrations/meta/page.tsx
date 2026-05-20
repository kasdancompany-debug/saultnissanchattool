import type { Metadata } from "next";

import { ChannelAccountsSettingsTable } from "@/components/settings/channel-accounts-settings-table";
import { IntegrationStatusRow } from "@/components/settings/integration-status-row";
import { IntegrationsSecretsCallout } from "@/components/settings/integrations-secrets-callout";
import { IntegrationsSettingsShell } from "@/components/settings/integrations-settings-shell";
import { SettingsReadOnlyBanner } from "@/components/settings/settings-read-only-banner";
import { SettingsSectionCard } from "@/components/settings/settings-section-card";
import { publicEnv } from "@/lib/env/public";
import { createSupabaseServerClient } from "@/integrations/supabase/server";
import { DEALERSHIP_CHANNEL_PROVIDER } from "@/server/data/dealership-channel-accounts";
import { requireStaff } from "@/server/auth/staff";
import {
  countActiveMetaInstagram,
  countActiveMetaMessenger,
  countActiveMetaWhatsapp,
  filterAccountsByProviders,
  loadIntegrationsDashboardData,
} from "@/server/settings/integrations-load";
import { staffCanEditDealershipSettings } from "@/server/settings/staff-privilege";

export const metadata: Metadata = {
  title: "Meta · Integrations",
};

export const dynamic = "force-dynamic";

export default async function IntegrationsMetaPage() {
  const staff = await requireStaff();
  const canEdit = staffCanEditDealershipSettings(staff);
  const supabase = await createSupabaseServerClient();
  const loaded = await loadIntegrationsDashboardData(
    staff.dealership_id,
    staff.dealership.twilio_phone_e164,
    supabase
  );

  const data = loaded.ok ? loaded.data : null;
  const metaRows = data
    ? filterAccountsByProviders(data.channelAccounts, [
        DEALERSHIP_CHANNEL_PROVIDER.META_MESSENGER,
        DEALERSHIP_CHANNEL_PROVIDER.META_INSTAGRAM,
        DEALERSHIP_CHANNEL_PROVIDER.META_WHATSAPP,
      ])
    : [];

  const messengerN = data ? countActiveMetaMessenger(data.channelAccounts) : 0;
  const instagramN = data ? countActiveMetaInstagram(data.channelAccounts) : 0;
  const whatsappN = data ? countActiveMetaWhatsapp(data.channelAccounts) : 0;

  const webhookUrl = `${publicEnv.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")}/api/webhooks/meta`;

  return (
    <IntegrationsSettingsShell
      title="Meta messaging"
      description="Messenger, Instagram DMs, and future WhatsApp — webhook readiness plus linked Page / account ids."
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
          description="Webhook secrets and tokens exist only in server environment variables."
        >
          <IntegrationStatusRow
            label="Meta webhook env (app secret, verify token, page token)"
            value={data?.metaWebhookEnvConfigured ? "Present" : "Missing"}
            tone={data?.metaWebhookEnvConfigured ? "positive" : "caution"}
          />
          <IntegrationStatusRow
            label="Messenger Page linked"
            value={messengerN > 0 ? `${messengerN} active` : "None"}
            tone={messengerN > 0 ? "positive" : "neutral"}
          />
          <IntegrationStatusRow
            label="Instagram account linked"
            value={instagramN > 0 ? `${instagramN} active` : "None"}
            tone={instagramN > 0 ? "positive" : "neutral"}
          />
          <IntegrationStatusRow
            label="WhatsApp (reserved)"
            value={whatsappN > 0 ? `${whatsappN} active` : "None"}
            tone="neutral"
          />
        </SettingsSectionCard>

        <SettingsSectionCard
          title="Webhook callback URL"
          description="Configure this URL in the Meta developer app (Webhooks product). No secrets below."
        >
          <div className="border-border bg-muted/20 rounded-lg border px-3 py-2.5">
            <code className="text-foreground/90 break-all font-mono text-[11px] leading-relaxed">
              {webhookUrl}
            </code>
          </div>
        </SettingsSectionCard>

        <SettingsSectionCard
          title="Meta channel accounts"
          description="External ids must match webhook recipient ids (Page id, Instagram professional account id, etc.)."
        >
          <ChannelAccountsSettingsTable
            rows={metaRows}
            emptyHint="No Meta channel rows yet. Add active meta_messenger / meta_instagram rows in dealership_channel_accounts so inbound DMs route to the inbox."
          />
        </SettingsSectionCard>

        <p className="text-muted-foreground max-w-2xl text-[11px] font-medium leading-relaxed">
          Guided onboarding to create rows and subscribe webhooks from this UI is planned. Until
          then, administrators manage identifiers in the database.
        </p>
      </main>
    </IntegrationsSettingsShell>
  );
}
