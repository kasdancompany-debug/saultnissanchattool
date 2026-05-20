import type { Json } from "@/integrations/supabase/database.types";

export function mergeConversationMetadata(
  previous: Json,
  patch: Record<string, unknown>
): Json {
  const base =
    typeof previous === "object" &&
    previous !== null &&
    !Array.isArray(previous)
      ? { ...(previous as Record<string, unknown>) }
      : {};
  return { ...base, ...patch } as Json;
}
