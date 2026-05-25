import type { Tables } from "@/integrations/supabase/database.types";

/** Client-safe message row for inbox thread UI (no server-only imports). */
export type InboxMessageView = Tables<"messages"> & {
  sender_label: string;
};
