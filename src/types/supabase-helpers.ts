import type { Database } from "./supabase";

/** Row shape for a table in `public`. */
export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];

/** Insert payload for PostgREST `.insert()` on a `public` table. */
export type TablesInsert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];

/** Update payload for PostgREST `.update()` on a `public` table. */
export type TablesUpdate<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];

/** Enum union from `Database["public"]["Enums"]` (e.g. `PublicEnum<"conversation_status">`). */
export type PublicEnum<T extends keyof Database["public"]["Enums"]> =
  Database["public"]["Enums"][T];

/**
 * Usage with `SupabaseClient<Database>`:
 *
 * - Typed table name: `supabase.from("messages")` infers Row / Insert / Update.
 * - Explicit row: `const row: Tables<"conversations"> = …`
 * - Insert payload: `const payload: TablesInsert<"messages"> = { conversation_id, sender_type, … }`
 * - RPC: `supabase.rpc("inbox_latest_message_previews_for_dealership", { p_dealership_id, p_conversation_ids })`
 *   returns types from `Database["public"]["Functions"][name]`.
 * - Enums: `const status: PublicEnum<"conversation_status"> = "open"`
 */
