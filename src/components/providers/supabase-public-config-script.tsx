import {
  CLIENT_PUBLIC_CONFIG_SCRIPT_ID,
  type ClientPublicRuntimeConfig,
} from "@/lib/env/client-public-runtime";

/** Injects public client config from server `getPublicEnv()` (auth, widget, redirects). */
export function SupabasePublicConfigScript({
  config,
}: {
  config: ClientPublicRuntimeConfig | null;
}) {
  if (!config) return null;

  return (
    <script
      id={CLIENT_PUBLIC_CONFIG_SCRIPT_ID}
      type="application/json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(config) }}
    />
  );
}
