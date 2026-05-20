import "server-only";

import { z } from "zod";

/**
 * Widget API secrets (optional until you enable the public widget).
 * Parsed on demand so core app startup is unchanged.
 */
const widgetSecretsSchema = z.object({
  /** HMAC key for signing widget session tokens (min 32 chars). */
  WIDGET_SESSION_SECRET: z.string().min(32),
  /**
   * Shared secret the embed must send (Authorization: Bearer or X-Widget-Key).
   * Omit only for local development; set in production.
   */
  WIDGET_API_KEY: z.string().min(16).optional(),
  /**
   * Comma-separated allowed browser origins for CORS (e.g. https://www.dealer.com,https://dealer.com).
   * Empty = deny cross-origin (same-site only). Use * only in non-production if you must.
   */
  WIDGET_CORS_ORIGINS: z.string().optional(),
});

export type WidgetSecrets = z.infer<typeof widgetSecretsSchema>;

const DEV_WIDGET_SESSION_SECRET =
  "dev-widget-session-secret-local-only-change-me-1234567890";

function resolveWidgetSessionSecret(): string | undefined {
  const configured = process.env.WIDGET_SESSION_SECRET?.trim();
  if (configured) {
    return configured;
  }
  // Keep local widget testing unblocked when the secret is not set.
  if (process.env.NODE_ENV !== "production") {
    return DEV_WIDGET_SESSION_SECRET;
  }
  return undefined;
}

export function getWidgetSecrets(): WidgetSecrets {
  return widgetSecretsSchema.parse({
    WIDGET_SESSION_SECRET: resolveWidgetSessionSecret(),
    WIDGET_API_KEY: process.env.WIDGET_API_KEY,
    WIDGET_CORS_ORIGINS: process.env.WIDGET_CORS_ORIGINS,
  });
}

export function isWidgetConfigured(): boolean {
  const secret = resolveWidgetSessionSecret();
  return Boolean(secret && secret.length >= 32);
}
