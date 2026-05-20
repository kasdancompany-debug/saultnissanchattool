/**
 * Reads signed session from `Authorization: Bearer` or `X-Widget-Session` (widget embed).
 */
export function readWidgetSessionToken(request: Request): string | null {
  const auth = request.headers.get("authorization");
  if (auth && auth.toLowerCase().startsWith("bearer ")) {
    return auth.slice(7).trim();
  }
  return request.headers.get("x-widget-session")?.trim() ?? null;
}

/**
 * Optional shared secret so the widget embed (not the whole internet) can call the API.
 * Send `Authorization: Bearer <key>` or `X-Widget-Key: <key>`.
 */
export function assertWidgetApiKey(request: Request, expected: string | undefined): void {
  if (!expected) {
    return;
  }
  const auth = request.headers.get("authorization");
  const headerKey = request.headers.get("x-widget-key");
  const bearer =
    auth && auth.toLowerCase().startsWith("bearer ")
      ? auth.slice(7).trim()
      : null;
  const got = bearer || headerKey?.trim();
  if (got !== expected) {
    const e = new Error("Invalid or missing widget API key");
    (e as Error & { code: string }).code = "UNAUTHORIZED";
    throw e;
  }
}
