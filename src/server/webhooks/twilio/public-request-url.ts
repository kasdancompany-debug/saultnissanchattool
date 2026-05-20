/**
 * Reconstructs the absolute URL Twilio posted to, for signature validation.
 * Prefer `x-forwarded-proto` / `x-forwarded-host` when behind a reverse proxy.
 */
export function getTwilioWebhookPublicUrl(request: Request): string {
  const url = new URL(request.url);
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const forwardedHost = request.headers.get("x-forwarded-host");
  const pathWithQuery = url.pathname + url.search;

  if (forwardedHost) {
    const proto = forwardedProto ?? url.protocol.replace(":", "");
    return `${proto}://${forwardedHost}${pathWithQuery}`;
  }

  return request.url;
}
