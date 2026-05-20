/**
 * Best-effort in-memory rate limits for widget API routes.
 *
 * **Production:** Replace with Redis / Upstash / Cloudflare rate limiting so limits are
 * consistent across instances and cannot be bypassed by fan-out. Monitor 429 rates in
 * your edge or API gateway dashboards.
 *
 * **Twilio webhooks:** Rely on Twilio signature validation + provider retries; add
 * edge rate limits only if abuse is observed (signed requests are already authenticated).
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

const WINDOW_MS = 60_000;

function prune(key: string, now: number): Bucket {
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    const fresh: Bucket = { count: 0, resetAt: now + WINDOW_MS };
    buckets.set(key, fresh);
    return fresh;
  }
  return b;
}

export function rateLimitOrThrow(
  key: string,
  maxPerWindow: number
): void {
  const now = Date.now();
  const b = prune(key, now);
  b.count += 1;
  if (b.count > maxPerWindow) {
    const err = new Error("RATE_LIMIT");
    (err as Error & { code: string }).code = "RATE_LIMIT";
    throw err;
  }
}

export function isRateLimitError(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    (e as { code?: string }).code === "RATE_LIMIT"
  );
}

export function clientIpFromRequest(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) {
    return xff.split(",")[0]?.trim() || "unknown";
  }
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}
