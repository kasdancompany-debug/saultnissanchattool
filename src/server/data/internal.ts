import {
  getServerDb,
  type TypedSupabaseClient,
} from "@/server/db/server-client";

/** Allows unit tests to inject a mock {@link TypedSupabaseClient}. */
export async function resolveDb(
  db?: TypedSupabaseClient
): Promise<TypedSupabaseClient> {
  return db ?? (await getServerDb());
}
