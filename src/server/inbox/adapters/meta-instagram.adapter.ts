import "server-only";

import type { TypedSupabaseClient } from "@/server/db/server-client";
import type { InboundNormalizedCore } from "@/server/messaging/inbound/normalized-inbound-message";
import { err, type Result } from "@/server/result";

import type { InboundApplyResult, InboundChannelAdapter } from "../channel-adapter";

const NOT_READY =
  "Meta Instagram DMs inbound is scaffolded only. Add webhook route + payload mapping.";

/**
 * Placeholder adapter — implement {@link InboundChannelAdapter} methods when the webhook ships.
 */
export const metaInstagramInboundAdapter: InboundChannelAdapter<unknown> = {
  channelKey: "meta_instagram",

  parseWebhookPayload(raw: unknown): Result<unknown> {
    void raw;
    return err("NOT_IMPLEMENTED", NOT_READY);
  },

  validateProviderRequest(parsed: unknown): Result<void> {
    void parsed;
    return err("NOT_IMPLEMENTED", NOT_READY);
  },

  normalize(parsed: unknown): Result<InboundNormalizedCore> {
    void parsed;
    return err("NOT_IMPLEMENTED", NOT_READY);
  },

  async ingest(raw: unknown, db: TypedSupabaseClient): Promise<Result<InboundApplyResult>> {
    void raw;
    void db;
    return err("NOT_IMPLEMENTED", NOT_READY);
  },
};
