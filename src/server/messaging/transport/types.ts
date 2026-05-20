import type { ConversationChannel } from "@/integrations/supabase/database.types";

/**
 * Context passed to outbound transports (Twilio, web widget, email, internal).
 * Keep this stable as providers are added.
 */
export type OutboundDispatchContext = {
  dealershipId: string;
  conversationId: string;
  messageId: string;
  body: string;
  channel: ConversationChannel;
};

export type OutboundDispatchResult =
  | {
      ok: true;
      providerMessageId?: string;
      /** Twilio SMS: numbers used for audit + messages.raw_payload. */
      twilio?: { to: string; from: string };
    }
  | { ok: false; code: string; message: string };

/**
 * Pluggable outbound delivery. Internal/no-op today; swap or chain providers later.
 */
export type OutboundTransport = {
  readonly id: string;
  dispatch(ctx: OutboundDispatchContext): Promise<OutboundDispatchResult>;
};
