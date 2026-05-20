import { createHmac, timingSafeEqual } from "crypto";

export type WidgetSessionPayload = {
  v: 1;
  conversationId: string;
  dealershipId: string;
  /** Unix seconds */
  exp: number;
};

function encodePayload(p: WidgetSessionPayload): string {
  return Buffer.from(JSON.stringify(p), "utf8").toString("base64url");
}

function decodePayload(raw: string): WidgetSessionPayload | null {
  try {
    const json = Buffer.from(raw, "base64url").toString("utf8");
    const o = JSON.parse(json) as Partial<WidgetSessionPayload>;
    if (o.v !== 1 || !o.conversationId || !o.dealershipId || typeof o.exp !== "number") {
      return null;
    }
    return {
      v: 1,
      conversationId: o.conversationId,
      dealershipId: o.dealershipId,
      exp: o.exp,
    };
  } catch {
    return null;
  }
}

export function signWidgetSessionToken(
  payload: Omit<WidgetSessionPayload, "v" | "exp"> & { ttlSeconds?: number },
  secret: string
): string {
  const exp =
    Math.floor(Date.now() / 1000) + (payload.ttlSeconds ?? 7 * 24 * 60 * 60);
  const full: WidgetSessionPayload = {
    v: 1,
    conversationId: payload.conversationId,
    dealershipId: payload.dealershipId,
    exp,
  };
  const body = encodePayload(full);
  const sig = createHmac("sha256", secret).update(body).digest("base64url");
  return `v1.${body}.${sig}`;
}

export function verifyWidgetSessionToken(
  token: string,
  secret: string
): WidgetSessionPayload | null {
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== "v1") {
    return null;
  }
  const [, body, sig] = parts;
  if (!body || !sig) {
    return null;
  }

  const expected = createHmac("sha256", secret).update(body).digest();
  let sigBuf: Buffer;
  try {
    sigBuf = Buffer.from(sig, "base64url");
  } catch {
    return null;
  }
  if (expected.length !== sigBuf.length || !timingSafeEqual(expected, sigBuf)) {
    return null;
  }

  const payload = decodePayload(body);
  if (!payload) {
    return null;
  }
  if (payload.exp < Math.floor(Date.now() / 1000)) {
    return null;
  }
  return payload;
}
