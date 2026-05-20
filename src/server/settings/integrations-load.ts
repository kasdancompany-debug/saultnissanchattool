import "server-only";

import { metaWebhookEnvSchema, twilioServerEnvSchema } from "@/lib/env/schema";
import {
  DEALERSHIP_CHANNEL_PROVIDER,
  listDealershipChannelAccountSettingsRows,
  type DealershipChannelAccountSettingsRow,
} from "@/server/data/dealership-channel-accounts";
import type { TypedSupabaseClient } from "@/server/db/server-client";
import { ok, type Result } from "@/server/result";

export type IntegrationsDashboardData = {
  channelAccounts: DealershipChannelAccountSettingsRow[];
  /** Twilio REST + default line env vars present (server-side only; never exposed to the client). */
  twilioServerEnvConfigured: boolean;
  /** Meta webhook + Graph env bundle present (server-side only). */
  metaWebhookEnvConfigured: boolean;
  /** Legacy column used when no `twilio_sms` channel row matches inbound `To`. */
  legacyTwilioPhoneE164: string | null;
};

function readTwilioEnvConfigured(): boolean {
  return twilioServerEnvSchema.safeParse({
    TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
    TWILIO_PHONE_NUMBER: process.env.TWILIO_PHONE_NUMBER,
  }).success;
}

function readMetaWebhookEnvConfigured(): boolean {
  return metaWebhookEnvSchema.safeParse({
    META_APP_SECRET: process.env.META_APP_SECRET,
    META_VERIFY_TOKEN: process.env.META_VERIFY_TOKEN,
    META_PAGE_ACCESS_TOKEN: process.env.META_PAGE_ACCESS_TOKEN,
  }).success;
}

/**
 * Loads non-secret integration state for settings UI (channel rows + coarse env presence flags).
 */
export async function loadIntegrationsDashboardData(
  dealershipId: string,
  legacyTwilioPhoneE164: string | null,
  supabase: TypedSupabaseClient
): Promise<Result<IntegrationsDashboardData>> {
  const rowsRes = await listDealershipChannelAccountSettingsRows(dealershipId, supabase);
  if (!rowsRes.ok) {
    return rowsRes;
  }

  return ok({
    channelAccounts: rowsRes.data,
    twilioServerEnvConfigured: readTwilioEnvConfigured(),
    metaWebhookEnvConfigured: readMetaWebhookEnvConfigured(),
    legacyTwilioPhoneE164: legacyTwilioPhoneE164?.trim() || null,
  });
}

export function filterAccountsByProviders(
  accounts: DealershipChannelAccountSettingsRow[],
  providers: readonly string[]
): DealershipChannelAccountSettingsRow[] {
  const set = new Set(providers);
  return accounts.filter((a) => set.has(a.provider));
}

export function countActiveTwilioSmsLines(
  accounts: DealershipChannelAccountSettingsRow[]
): number {
  return accounts.filter(
    (a) => a.provider === DEALERSHIP_CHANNEL_PROVIDER.TWILIO_SMS && a.is_active
  ).length;
}

export function countActiveMetaMessenger(
  accounts: DealershipChannelAccountSettingsRow[]
): number {
  return accounts.filter(
    (a) => a.provider === DEALERSHIP_CHANNEL_PROVIDER.META_MESSENGER && a.is_active
  ).length;
}

export function countActiveMetaInstagram(
  accounts: DealershipChannelAccountSettingsRow[]
): number {
  return accounts.filter(
    (a) => a.provider === DEALERSHIP_CHANNEL_PROVIDER.META_INSTAGRAM && a.is_active
  ).length;
}

export function countActiveMetaWhatsapp(
  accounts: DealershipChannelAccountSettingsRow[]
): number {
  return accounts.filter(
    (a) => a.provider === DEALERSHIP_CHANNEL_PROVIDER.META_WHATSAPP && a.is_active
  ).length;
}
