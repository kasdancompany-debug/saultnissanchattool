import type { OutboundDispatchContext, OutboundTransport } from "./types";

/**
 * Persists the message in-app; customer-facing delivery happens elsewhere for now.
 * When SMS/web providers are wired, they run after this or replace queued → sent logic.
 */
export const internalOutboundTransport: OutboundTransport = {
  id: "internal",
  async dispatch(ctx: OutboundDispatchContext) {
    void ctx;
    return { ok: true as const };
  },
};
