import type { Metadata } from "next";
import Link from "next/link";

import { IntegrationHubLinkCard } from "@/components/settings/integration-hub-link-card";
import { IntegrationsSecretsCallout } from "@/components/settings/integrations-secrets-callout";
import { IntegrationsSettingsShell } from "@/components/settings/integrations-settings-shell";
import { createSupabaseServerClient } from "@/integrations/supabase/server";
import {
  countActiveMetaInstagram,
  countActiveMetaMessenger,
  countActiveMetaWhatsapp,
  countActiveTwilioSmsLines,
  loadIntegrationsDashboardData,
} from "@/server/settings/integrations-load";
import { requireStaff } from "@/server/auth/staff";

export const metadata: Metadata = {
  title: "Integrations · Settings",
};

export const dynamic = "force-dynamic";

function twilioHubLabel(data: {
  twilioServerEnvConfigured: boolean;
  activeSmsLines: number;
  legacyPhone: string | null;
}): { label: string; tone: "positive" | "caution" | "neutral" } {
  const hasRoute = data.activeSmsLines > 0 || Boolean(data.legacyPhone?.trim());
  if (data.twilioServerEnvConfigured && hasRoute) {
    return { label: "Ready for SMS", tone: "positive" };
  }
  if (data.twilioServerEnvConfigured || hasRoute) {
    return { label: "Partial setup — review Twilio page", tone: "caution" };
  }
  return { label: "Not configured", tone: "neutral" };
}

function metaHubLabel(data: {
  metaWebhookEnvConfigured: boolean;
  messenger: number;
  instagram: number;
  whatsapp: number;
}): { label: string; tone: "positive" | "caution" | "neutral" } {
  const hasAccounts = data.messenger + data.instagram + data.whatsapp > 0;
  if (data.metaWebhookEnvConfigured && hasAccounts) {
    return { label: "Webhook + channel accounts present", tone: "positive" };
  }
  if (data.metaWebhookEnvConfigured || hasAccounts) {
    return { label: "Partial setup — review Meta page", tone: "caution" };
  }
  return { label: "Not configured", tone: "neutral" };
}

export default async function IntegrationsOverviewPage() {
  const staff = await requireStaff();
  const supabase = await createSupabaseServerClient();
  const loaded = await loadIntegrationsDashboardData(
    staff.dealership_id,
    staff.dealership.twilio_phone_e164,
    supabase
  );

  if (!loaded.ok) {
    return (
      <IntegrationsSettingsShell
        title="Integrations"
        description="External messaging connections for your dealership."
      >
        <main className="flex-1 space-y-4 px-4 py-4 sm:px-6 sm:py-5">
          <p className="text-destructive text-sm" role="alert">
            Could not load channel accounts ({loaded.error.message}).
          </p>
          <Link
            href="/settings/profile"
            className="text-primary text-sm font-medium underline-offset-4 hover:underline"
          >
            Back to profile
          </Link>
        </main>
      </IntegrationsSettingsShell>
    );
  }

  const data = loaded.data;
  const activeSms = countActiveTwilioSmsLines(data.channelAccounts);
  const twilioStatus = twilioHubLabel({
    twilioServerEnvConfigured: data.twilioServerEnvConfigured,
    activeSmsLines: activeSms,
    legacyPhone: data.legacyTwilioPhoneE164,
  });

  const metaStatus = metaHubLabel({
    metaWebhookEnvConfigured: data.metaWebhookEnvConfigured,
    messenger: countActiveMetaMessenger(data.channelAccounts),
    instagram: countActiveMetaInstagram(data.channelAccounts),
    whatsapp: countActiveMetaWhatsapp(data.channelAccounts),
  });

  return (
    <IntegrationsSettingsShell
      title="Integrations"
      description="Twilio SMS and Meta messaging — see what is connected without exposing secrets."
    >
      <main className="flex-1 space-y-5 px-4 py-4 sm:px-6 sm:py-5">
        <IntegrationsSecretsCallout />

        <div className="grid gap-4 sm:grid-cols-2">
          <IntegrationHubLinkCard
            href="/settings/integrations/twilio"
            title="Twilio"
            description="Inbound SMS lines, legacy dealership number, and integration notes."
            statusLabel={twilioStatus.label}
            statusTone={twilioStatus.tone}
          />
          <IntegrationHubLinkCard
            href="/settings/integrations/meta"
            title="Meta"
            description="Messenger, Instagram DMs, and future WhatsApp — Page and account identifiers."
            statusLabel={metaStatus.label}
            statusTone={metaStatus.tone}
          />
        </div>

        <p className="text-muted-foreground max-w-2xl text-[11px] font-medium leading-relaxed">
          Onboarding flows for adding lines and Meta assets from this UI will arrive later — today
          channel rows are managed in the database by administrators.
        </p>
      </main>
    </IntegrationsSettingsShell>
  );
}
