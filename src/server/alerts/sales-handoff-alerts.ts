import "server-only";

import { captureServerException } from "@/lib/observability/server-capture";

export type SalesHandoffAlertPayload = {
  dealershipId: string;
  conversationId: string;
  department: string;
  assignedToUserId: string | null;
  rulesApplied: string[];
  occurredAt: string;
  customerLabel?: string | null;
  lastCustomerMessage?: string | null;
  inboxUrl?: string | null;
};

/**
 * Optional webhook hook for handoff notifications (Slack/Zapier/email relay).
 * Set `SALES_HANDOFF_WEBHOOK_URL` to enable.
 */
export async function notifySalesHandoffAlert(
  payload: SalesHandoffAlertPayload
): Promise<void> {
  const url = process.env.SALES_HANDOFF_WEBHOOK_URL?.trim();
  if (!url) {
    return;
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...payload,
        event: "sales_handoff",
        message:
          payload.customerLabel && payload.lastCustomerMessage
            ? `${payload.customerLabel}: "${payload.lastCustomerMessage.slice(0, 200)}"`
            : "A customer needs a human reply in the inbox.",
      }),
    });
    if (!res.ok) {
      throw new Error(`Webhook returned ${res.status}`);
    }
  } catch (error) {
    captureServerException(error, {
      where: "notifySalesHandoffAlert",
      dealershipId: payload.dealershipId,
      conversationId: payload.conversationId,
    });
  }
}

