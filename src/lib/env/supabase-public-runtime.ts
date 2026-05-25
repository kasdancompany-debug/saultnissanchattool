import {
  readClientPublicRuntimeConfigFromDom,
  type ClientPublicRuntimeConfig,
} from "@/lib/env/client-public-runtime";

/** @deprecated Use {@link ClientPublicRuntimeConfig} */
export type SupabasePublicRuntimeConfig = Pick<
  ClientPublicRuntimeConfig,
  "url" | "anonKey" | "appUrl"
>;

export function readSupabasePublicRuntimeConfigFromDom():
  | SupabasePublicRuntimeConfig
  | null {
  const data = readClientPublicRuntimeConfigFromDom();
  if (!data) return null;
  const url = data.url?.trim() ?? "";
  const anonKey = data.anonKey?.trim() ?? "";
  const appUrl = data.appUrl?.trim() ?? "";
  if (!url || !anonKey) return null;
  return { url, anonKey, appUrl };
}
