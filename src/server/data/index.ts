/**
 * Server-side data access for the chat domain. UI should use server components, server
 * actions, and route handlers that delegate here — no raw Supabase in client components.
 *
 * Core modules (conversation + message access):
 * - `conversations` — list/filter, get, create, status updates, SMS helpers
 * - `messages` — thread reads, inserts (trigger maintains `last_message_at`)
 * - `assignments` — assign + history + scoped lookup
 *
 * Inbox-specific composed loaders (`inbox`) build on these for UI-ready rows.
 */

export * from "@/server/data/assignments";
export * from "@/server/data/conversation-events";
export * from "@/server/data/conversation-queries";
export * from "@/server/data/conversation-workflow";
export * from "@/server/data/conversations";
export * from "@/server/data/customers";
export * from "@/server/data/dealership-channel-accounts";
export * from "@/server/data/inbox";
export * from "@/server/data/messages";
export * from "@/server/data/postgrest-error";
export * from "@/server/data/staff-users";
