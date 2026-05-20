import "server-only";

import { createSupabaseAdminClient } from "@/integrations/supabase/admin";
import {
  DEALERSHIP_CHANNEL_PROVIDER,
  findDealershipIdByMetaExternalAccount,
} from "@/server/data/dealership-channel-accounts";
import { captureServerException } from "@/lib/observability/server-capture";
import { applyInboundMessage } from "@/server/messaging/inbound/apply-inbound-message";
import type {
  InboundNormalizedCore,
  NormalizedInboundMessage,
} from "@/server/messaging/inbound/normalized-inbound-message";

export type MetaInboundBatchStats = {
  /** New rows persisted via {@link applyInboundMessage}. */
  inserted: number;
  /** Idempotent replays (same `external_message_id` within the active conversation thread). */
  duplicates: number;
  /** Missing `channelAccountId` on normalized core (cannot route). */
  skippedMissingChannelAccount: number;
  /** No active `dealership_channel_accounts` row for this Page / IG account id. */
  skippedUnknownDealership: number;
  /** PostgREST / DB error while resolving dealership. */
  dealershipLookupFailures: number;
  /** `applyInboundMessage` returned an error (logged). */
  applyFailures: number;
};

function metaProviderForChannel(
  channel: InboundNormalizedCore["channel"]
):
  | typeof DEALERSHIP_CHANNEL_PROVIDER.META_MESSENGER
  | typeof DEALERSHIP_CHANNEL_PROVIDER.META_INSTAGRAM
  | null {
  if (channel === "messenger") {
    return DEALERSHIP_CHANNEL_PROVIDER.META_MESSENGER;
  }
  if (channel === "instagram") {
    return DEALERSHIP_CHANNEL_PROVIDER.META_INSTAGRAM;
  }
  return null;
}

/**
 * Persists normalized Meta private text DMs through the shared inbox pipeline.
 *
 * - Resolves `dealershipId` from `channelAccountId` (webhook `recipient.id`) via `dealership_channel_accounts`.
 * - Deduplication: {@link applyInboundMessage} uses `metadata.external_message_id` per conversation (Meta `mid`).
 * - Unknown Page / IG account: skipped with a log line (HTTP layer still returns 200 so Meta does not retry aggressively).
 */
export async function applyMetaInboundNormalizedCores(
  cores: InboundNormalizedCore[]
): Promise<MetaInboundBatchStats> {
  const db = createSupabaseAdminClient();
  const stats: MetaInboundBatchStats = {
    inserted: 0,
    duplicates: 0,
    skippedMissingChannelAccount: 0,
    skippedUnknownDealership: 0,
    dealershipLookupFailures: 0,
    applyFailures: 0,
  };

  for (const core of cores) {
    const provider = metaProviderForChannel(core.channel);
    if (!provider) {
      console.info("[meta inbound] skip_unsupported_channel", { channel: core.channel });
      continue;
    }

    const accountId = core.channelAccountId?.trim();
    if (!accountId) {
      stats.skippedMissingChannelAccount += 1;
      console.info("[meta inbound] skip_missing_channel_account", {
        channel: core.channel,
        externalMessageIdSuffix: tailId(core.externalMessageId),
      });
      continue;
    }

    const dealershipRes = await findDealershipIdByMetaExternalAccount(provider, accountId, db);
    if (!dealershipRes.ok) {
      stats.dealershipLookupFailures += 1;
      captureServerException(new Error(dealershipRes.error.message), {
        pipeline: "meta_inbound",
        step: "resolve_dealership",
        provider,
      });
      continue;
    }

    if (!dealershipRes.data) {
      stats.skippedUnknownDealership += 1;
      console.info("[meta inbound] unknown_channel_account", {
        provider,
        accountIdSuffix: tailId(accountId),
      });
      continue;
    }

    const normalized: NormalizedInboundMessage = {
      ...core,
      dealershipId: dealershipRes.data,
    };

    const applied = await applyInboundMessage(normalized, db);
    if (!applied.ok) {
      stats.applyFailures += 1;
      console.error("[meta inbound] apply_failed", {
        code: applied.error.code,
        message: applied.error.message,
        externalMessageIdSuffix: tailId(core.externalMessageId),
        channel: core.channel,
      });
      continue;
    }

    if (applied.data.duplicate) {
      stats.duplicates += 1;
    } else {
      stats.inserted += 1;
    }
  }

  return stats;
}

function tailId(value: string): string {
  const v = value.trim();
  if (v.length <= 8) {
    return v;
  }
  return v.slice(-8);
}
