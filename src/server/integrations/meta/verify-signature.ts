import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Validates Meta `X-Hub-Signature-256: sha256=<hex>` against the raw POST body (UTF-8).
 * @see https://developers.facebook.com/docs/graph-api/webhooks/getting-started#verification-requests
 */
export function verifyMetaWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  appSecret: string
): boolean {
  if (!signatureHeader || !signatureHeader.startsWith("sha256=")) {
    return false;
  }
  const receivedHex = signatureHeader.slice("sha256=".length).trim();
  const expectedHex = createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");

  if (receivedHex.length !== expectedHex.length) {
    return false;
  }

  try {
    const a = Buffer.from(receivedHex, "hex");
    const b = Buffer.from(expectedHex, "hex");
    if (a.length !== b.length) {
      return false;
    }
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
