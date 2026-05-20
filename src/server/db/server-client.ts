import { createSupabaseServerClient } from "@/integrations/supabase/server";
import type { Database } from "@/types/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Typed Supabase client for server-side data access. */
export type TypedSupabaseClient = SupabaseClient<Database>;

/**
 * Single entry for server repositories + tests (inject a mock client via {@link withDbClient}).
 */
export async function getServerDb(): Promise<TypedSupabaseClient> {
  return createSupabaseServerClient();
}
