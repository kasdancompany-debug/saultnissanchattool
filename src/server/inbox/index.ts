/**
 * Inbox inbound integration: channel adapters, shared types, and re-exports of the persistence pipeline.
 * Core write path remains {@link applyInboundMessage} under `server/messaging/inbound`.
 */
export type { InboundApplyResult, InboundChannelAdapter } from "./channel-adapter";
export { parseValidateNormalize } from "./channel-adapter";

export type {
  InboundNormalizedCore,
  InboundProductChannel,
  NormalizedInboundMessage,
} from "@/server/messaging/inbound/normalized-inbound-message";
export { toDbConversationChannel } from "@/server/messaging/inbound/normalized-inbound-message";
export type { ApplyInboundMessageOutcome } from "@/server/messaging/inbound/apply-inbound-message";
export { applyInboundMessage } from "@/server/messaging/inbound/apply-inbound-message";
export { runPostInboundMessageHooks } from "@/server/messaging/inbound/post-inbound-hooks";

export * from "./adapters";
