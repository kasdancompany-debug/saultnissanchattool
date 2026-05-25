import type { PublicEnv } from "@/lib/env/schema";

/** Public config injected from the server layout (safe to expose in the browser). */
export type ClientPublicRuntimeConfig = {
  url: string;
  anonKey: string;
  appUrl: string;
  widgetDealershipSlug: string;
  widgetApiKey: string;
  widgetApiOrigin: string;
  widgetWelcomeMessage: string;
  widgetAfterHoursMessage: string;
  widgetContactPhoneTel: string;
  widgetContactPhoneLabel: string;
  widgetContactEmail: string;
};

export const CLIENT_PUBLIC_CONFIG_SCRIPT_ID = "supabase-public-config";

export function readClientPublicRuntimeConfigFromDom(): Partial<ClientPublicRuntimeConfig> | null {
  if (typeof document === "undefined") return null;
  const el = document.getElementById(CLIENT_PUBLIC_CONFIG_SCRIPT_ID);
  if (!el?.textContent?.trim()) return null;
  try {
    return JSON.parse(el.textContent) as Partial<ClientPublicRuntimeConfig>;
  } catch {
    return null;
  }
}

/** Merge server-injected runtime config with build-time `NEXT_PUBLIC_*` (widget + auth). */
export function mergeClientPublicEnv(buildTime: PublicEnv): PublicEnv {
  const injected = readClientPublicRuntimeConfigFromDom();
  if (!injected) return buildTime;

  const pick = (key: keyof ClientPublicRuntimeConfig, fallback: string) => {
    const v = injected[key]?.trim();
    return v && v.length > 0 ? v : fallback;
  };

  const url = pick("url", buildTime.NEXT_PUBLIC_SUPABASE_URL);
  const anonKey = pick("anonKey", buildTime.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  return {
    ...buildTime,
    NEXT_PUBLIC_SUPABASE_URL: url,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey,
    NEXT_PUBLIC_APP_URL: pick("appUrl", buildTime.NEXT_PUBLIC_APP_URL),
    NEXT_PUBLIC_WIDGET_DEALERSHIP_SLUG: pick(
      "widgetDealershipSlug",
      buildTime.NEXT_PUBLIC_WIDGET_DEALERSHIP_SLUG
    ),
    NEXT_PUBLIC_WIDGET_API_KEY: pick("widgetApiKey", buildTime.NEXT_PUBLIC_WIDGET_API_KEY),
    NEXT_PUBLIC_WIDGET_API_ORIGIN: pick(
      "widgetApiOrigin",
      buildTime.NEXT_PUBLIC_WIDGET_API_ORIGIN
    ),
    NEXT_PUBLIC_WIDGET_AFTER_HOURS_MESSAGE: pick(
      "widgetAfterHoursMessage",
      buildTime.NEXT_PUBLIC_WIDGET_AFTER_HOURS_MESSAGE
    ),
    NEXT_PUBLIC_WIDGET_WELCOME_MESSAGE: pick(
      "widgetWelcomeMessage",
      buildTime.NEXT_PUBLIC_WIDGET_WELCOME_MESSAGE
    ),
    NEXT_PUBLIC_WIDGET_CONTACT_PHONE_TEL: pick(
      "widgetContactPhoneTel",
      buildTime.NEXT_PUBLIC_WIDGET_CONTACT_PHONE_TEL
    ),
    NEXT_PUBLIC_WIDGET_CONTACT_PHONE_LABEL: pick(
      "widgetContactPhoneLabel",
      buildTime.NEXT_PUBLIC_WIDGET_CONTACT_PHONE_LABEL
    ),
    NEXT_PUBLIC_WIDGET_CONTACT_EMAIL: pick(
      "widgetContactEmail",
      buildTime.NEXT_PUBLIC_WIDGET_CONTACT_EMAIL
    ),
  };
}

export function buildClientPublicRuntimeConfig(env: PublicEnv): ClientPublicRuntimeConfig | null {
  const appUrl = env.NEXT_PUBLIC_APP_URL?.trim() ?? "";
  if (!appUrl || appUrl.includes("build-placeholder")) {
    return null;
  }

  const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";

  return {
    url,
    anonKey,
    appUrl,
    widgetDealershipSlug: env.NEXT_PUBLIC_WIDGET_DEALERSHIP_SLUG,
    widgetApiKey: env.NEXT_PUBLIC_WIDGET_API_KEY,
    widgetApiOrigin: env.NEXT_PUBLIC_WIDGET_API_ORIGIN,
    widgetWelcomeMessage: env.NEXT_PUBLIC_WIDGET_WELCOME_MESSAGE,
    widgetAfterHoursMessage: env.NEXT_PUBLIC_WIDGET_AFTER_HOURS_MESSAGE,
    widgetContactPhoneTel: env.NEXT_PUBLIC_WIDGET_CONTACT_PHONE_TEL,
    widgetContactPhoneLabel: env.NEXT_PUBLIC_WIDGET_CONTACT_PHONE_LABEL,
    widgetContactEmail: env.NEXT_PUBLIC_WIDGET_CONTACT_EMAIL,
  };
}
