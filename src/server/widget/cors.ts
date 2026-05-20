import type { WidgetSecrets } from "@/lib/env/widget";

/**
 * Returns CORS headers for widget embeds. Prefer an explicit allowlist; avoid "*"
 * in production when credentials or sensitive operations are involved.
 */
export function widgetCorsHeaders(
  request: Request,
  secrets: WidgetSecrets
): Record<string, string> {
  const origin = request.headers.get("origin");
  const raw = secrets.WIDGET_CORS_ORIGINS?.trim();
  const allowed = raw
    ? raw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  let allowOrigin: string;
  if (allowed.length === 0) {
    allowOrigin =
      process.env.NODE_ENV === "development" ? "*" : "null";
  } else if (origin && allowed.includes(origin)) {
    allowOrigin = origin;
  } else if (allowed.length === 1) {
    allowOrigin = allowed[0]!;
  } else {
    allowOrigin = "null";
  }

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, X-Widget-Key, X-Requested-With",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}
