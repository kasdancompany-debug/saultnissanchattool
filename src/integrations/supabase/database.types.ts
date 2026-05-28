/**
 * Ergonomic re-exports for app code. Enum aliases are derived from {@link Database} so they stay
 * correct after `npm run types:supabase` regenerates `src/types/supabase.ts`.
 *
 * Prefer `import type { … } from "@/integrations/supabase/database.types"` in existing modules;
 * new code may import from `@/types/supabase` / `@/types/supabase-helpers` directly.
 */
import type { Database, Json } from "@/types/supabase";

export type { Json, Database };

export type StaffRole = Database["public"]["Enums"]["staff_role"];
export type StaffDepartment = Database["public"]["Enums"]["staff_department"];
export type ConversationChannel = Database["public"]["Enums"]["conversation_channel"];
export type ConversationStatus = Database["public"]["Enums"]["conversation_status"];
export type ConversationPriority = Database["public"]["Enums"]["conversation_priority"];
export type Sentiment = Database["public"]["Enums"]["sentiment"];
export type MessageSenderType = Database["public"]["Enums"]["message_sender_type"];
export type MessageDeliveryStatus = Database["public"]["Enums"]["message_delivery_status"];
export type ConversationEventType = Database["public"]["Enums"]["conversation_event_type"];
export type SocialEngagementHandlingState =
  Database["public"]["Enums"]["social_engagement_handling_state"];
export type AppointmentDepartment =
  Database["public"]["Enums"]["appointment_department"];
export type AppointmentStatus =
  Database["public"]["Enums"]["appointment_status"];
export type AppointmentSource =
  Database["public"]["Enums"]["appointment_source"];

export type {
  Tables,
  TablesInsert,
  TablesUpdate,
  PublicEnum,
} from "@/types/supabase-helpers";
