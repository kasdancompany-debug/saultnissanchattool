/**
 * Supabase generated types — `public` schema (tables, enums, RPCs).
 *
 * Regenerate with the Supabase CLI (requires login or access token):
 *
 *   npm run types:supabase
 *
 * Or manually:
 *
 *   npx supabase gen types typescript --linked --schema public > src/types/supabase.ts
 *   npx supabase gen types typescript --project-id <PROJECT_REF> --schema public > src/types/supabase.ts
 *
 * On Windows PowerShell, prefer `npm run types:supabase` so UTF-8 output is correct.
 *
 * After regenerating, run `npx tsc --noEmit` and fix any drift. Helpers live in
 * `supabase-helpers.ts` and are not overwritten.
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type StaffRole =
  | "admin"
  | "manager"
  | "advisor"
  | "bdc"
  | "readonly";

export type StaffDepartment =
  | "sales"
  | "service"
  | "parts"
  | "bdc"
  | "management"
  | "general";

export type ConversationChannel =
  | "sms"
  | "web_chat"
  | "email"
  | "facebook"
  | "other";

export type ConversationStatus =
  | "open"
  | "pending"
  | "waiting_for_human"
  | "resolved"
  | "closed"
  | "archived"
  | "spam";

export type ConversationPriority = "low" | "normal" | "high" | "urgent";

export type Sentiment = "unknown" | "positive" | "neutral" | "negative";

export type MessageSenderType = "customer" | "staff" | "system" | "ai";

export type MessageDeliveryStatus =
  | "pending"
  | "queued"
  | "sent"
  | "delivered"
  | "failed"
  | "read";

export type SocialEngagementHandlingState =
  | "unhandled"
  | "handled"
  | "dismissed";

export type ConversationEventType =
  | "conversation_created"
  | "conversation_updated"
  | "status_changed"
  | "priority_changed"
  | "department_changed"
  | "channel_changed"
  | "sentiment_updated"
  | "ai_toggled"
  | "assignment_created"
  | "assignment_removed"
  | "message_inbound"
  | "message_outbound"
  | "staff_reply"
  | "customer_linked"
  | "integration_error"
  | "routing_rule_applied"
  | "metadata_changed"
  | "after_hours_intake"
  | "sentiment_escalation"
  | "ai_reply_sent"
  | "waiting_for_human"
  | "human_claimed"
  | "human_reply_sent"
  | "ai_assist_enabled"
  | "service_scheduler_link_sent";

export type LeadOfferEventType = "view" | "start" | "complete" | "lead";

export type AppointmentDepartment = "sales" | "service";

export type AppointmentStatus =
  | "proposed"
  | "awaiting_confirmation"
  | "confirmed"
  | "completed"
  | "no_show"
  | "cancelled";

export type AppointmentSource = "ai_detected" | "manual" | "quick_action";

export type Database = {
  public: {
    Tables: {
      dealerships: {
        Row: {
          id: string;
          name: string;
          slug: string | null;
          timezone: string;
          business_hours: Json;
          twilio_phone_e164: string | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug?: string | null;
          timezone?: string;
          business_hours?: Json;
          twilio_phone_e164?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string | null;
          timezone?: string;
          business_hours?: Json;
          twilio_phone_e164?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      dealership_channel_accounts: {
        Row: {
          id: string;
          dealership_id: string;
          provider: string;
          external_account_id: string;
          display_label: string;
          is_active: boolean;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          dealership_id: string;
          provider: string;
          external_account_id: string;
          display_label?: string;
          is_active?: boolean;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          dealership_id?: string;
          provider?: string;
          external_account_id?: string;
          display_label?: string;
          is_active?: boolean;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "dealership_channel_accounts_dealership_id_fkey";
            columns: ["dealership_id"];
            isOneToOne: false;
            referencedRelation: "dealerships";
            referencedColumns: ["id"];
          },
        ];
      };
      staff_users: {
        Row: {
          id: string;
          dealership_id: string;
          email: string;
          display_name: string;
          role: StaffRole;
          department: StaffDepartment;
          is_active: boolean;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          dealership_id: string;
          email: string;
          display_name: string;
          role?: StaffRole;
          department?: StaffDepartment;
          is_active?: boolean;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          dealership_id?: string;
          email?: string;
          display_name?: string;
          role?: StaffRole;
          department?: StaffDepartment;
          is_active?: boolean;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "staff_users_dealership_id_fkey";
            columns: ["dealership_id"];
            isOneToOne: false;
            referencedRelation: "dealerships";
            referencedColumns: ["id"];
          },
        ];
      };
      social_engagement_items: {
        Row: {
          id: string;
          dealership_id: string;
          platform: string;
          external_comment_id: string;
          post_reference: Json;
          commenter: Json;
          body: string;
          occurred_at: string;
          received_at: string;
          handling_state: SocialEngagementHandlingState;
          handled_at: string | null;
          handled_by_user_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          dealership_id: string;
          platform: string;
          external_comment_id: string;
          post_reference?: Json;
          commenter?: Json;
          body: string;
          occurred_at: string;
          received_at?: string;
          handling_state?: SocialEngagementHandlingState;
          handled_at?: string | null;
          handled_by_user_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          dealership_id?: string;
          platform?: string;
          external_comment_id?: string;
          post_reference?: Json;
          commenter?: Json;
          body?: string;
          occurred_at?: string;
          received_at?: string;
          handling_state?: SocialEngagementHandlingState;
          handled_at?: string | null;
          handled_by_user_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "social_engagement_items_dealership_id_fkey";
            columns: ["dealership_id"];
            isOneToOne: false;
            referencedRelation: "dealerships";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "social_engagement_items_handled_by_user_id_fkey";
            columns: ["handled_by_user_id"];
            isOneToOne: false;
            referencedRelation: "staff_users";
            referencedColumns: ["id"];
          },
        ];
      };
      customers: {
        Row: {
          id: string;
          dealership_id: string;
          display_name: string | null;
          email: string | null;
          phone_e164: string | null;
          external_id: string | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          dealership_id: string;
          display_name?: string | null;
          email?: string | null;
          phone_e164?: string | null;
          external_id?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          dealership_id?: string;
          display_name?: string | null;
          email?: string | null;
          phone_e164?: string | null;
          external_id?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "customers_dealership_id_fkey";
            columns: ["dealership_id"];
            isOneToOne: false;
            referencedRelation: "dealerships";
            referencedColumns: ["id"];
          },
        ];
      };
      conversations: {
        Row: {
          id: string;
          dealership_id: string;
          customer_id: string | null;
          channel: ConversationChannel;
          department: StaffDepartment;
          status: ConversationStatus;
          priority: ConversationPriority;
          sentiment: Sentiment;
          ai_enabled: boolean;
          assigned_to_user_id: string | null;
          last_message_at: string | null;
          title: string | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          dealership_id: string;
          customer_id?: string | null;
          channel: ConversationChannel;
          department?: StaffDepartment;
          status?: ConversationStatus;
          priority?: ConversationPriority;
          sentiment?: Sentiment;
          ai_enabled?: boolean;
          assigned_to_user_id?: string | null;
          last_message_at?: string | null;
          title?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          dealership_id?: string;
          customer_id?: string | null;
          channel?: ConversationChannel;
          department?: StaffDepartment;
          status?: ConversationStatus;
          priority?: ConversationPriority;
          sentiment?: Sentiment;
          ai_enabled?: boolean;
          assigned_to_user_id?: string | null;
          last_message_at?: string | null;
          title?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "conversations_dealership_id_fkey";
            columns: ["dealership_id"];
            isOneToOne: false;
            referencedRelation: "dealerships";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "conversations_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "conversations_assigned_to_user_id_fkey";
            columns: ["assigned_to_user_id"];
            isOneToOne: false;
            referencedRelation: "staff_users";
            referencedColumns: ["id"];
          },
        ];
      };
      messages: {
        Row: {
          id: string;
          conversation_id: string;
          sender_type: MessageSenderType;
          sender_user_id: string | null;
          body: string;
          raw_payload: Json;
          delivery_status: MessageDeliveryStatus;
          metadata: Json;
          twilio_inbound_sid: string | null;
          twilio_outbound_sid: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          sender_type: MessageSenderType;
          sender_user_id?: string | null;
          body?: string;
          raw_payload?: Json;
          delivery_status?: MessageDeliveryStatus;
          metadata?: Json;
          twilio_inbound_sid?: string | null;
          twilio_outbound_sid?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          conversation_id?: string;
          sender_type?: MessageSenderType;
          sender_user_id?: string | null;
          body?: string;
          raw_payload?: Json;
          delivery_status?: MessageDeliveryStatus;
          metadata?: Json;
          twilio_inbound_sid?: string | null;
          twilio_outbound_sid?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey";
            columns: ["conversation_id"];
            isOneToOne: false;
            referencedRelation: "conversations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "messages_sender_user_id_fkey";
            columns: ["sender_user_id"];
            isOneToOne: false;
            referencedRelation: "staff_users";
            referencedColumns: ["id"];
          },
        ];
      };
      conversation_events: {
        Row: {
          id: string;
          conversation_id: string;
          event_type: ConversationEventType;
          actor_user_id: string | null;
          payload: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          event_type: ConversationEventType;
          actor_user_id?: string | null;
          payload?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          conversation_id?: string;
          event_type?: ConversationEventType;
          actor_user_id?: string | null;
          payload?: Json;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "conversation_events_conversation_id_fkey";
            columns: ["conversation_id"];
            isOneToOne: false;
            referencedRelation: "conversations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "conversation_events_actor_user_id_fkey";
            columns: ["actor_user_id"];
            isOneToOne: false;
            referencedRelation: "staff_users";
            referencedColumns: ["id"];
          },
        ];
      };
      conversation_assignments: {
        Row: {
          id: string;
          conversation_id: string;
          assigned_to_user_id: string;
          assigned_by_user_id: string | null;
          note: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          assigned_to_user_id: string;
          assigned_by_user_id?: string | null;
          note?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          conversation_id?: string;
          assigned_to_user_id?: string;
          assigned_by_user_id?: string | null;
          note?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "conversation_assignments_conversation_id_fkey";
            columns: ["conversation_id"];
            isOneToOne: false;
            referencedRelation: "conversations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "conversation_assignments_assigned_to_user_id_fkey";
            columns: ["assigned_to_user_id"];
            isOneToOne: false;
            referencedRelation: "staff_users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "conversation_assignments_assigned_by_user_id_fkey";
            columns: ["assigned_by_user_id"];
            isOneToOne: false;
            referencedRelation: "staff_users";
            referencedColumns: ["id"];
          },
        ];
      };
      telephony_event_dedupe: {
        Row: {
          dedupe_key: string;
          dealership_id: string;
          kind: string;
          created_at: string;
        };
        Insert: {
          dedupe_key: string;
          dealership_id: string;
          kind?: string;
          created_at?: string;
        };
        Update: {
          dedupe_key?: string;
          dealership_id?: string;
          kind?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "telephony_event_dedupe_dealership_id_fkey";
            columns: ["dealership_id"];
            isOneToOne: false;
            referencedRelation: "dealerships";
            referencedColumns: ["id"];
          },
        ];
      };
      message_ai_runs: {
        Row: {
          id: string;
          dealership_id: string;
          conversation_id: string;
          message_id: string;
          prompt_version: string;
          model: string;
          structured_output: Json;
          latency_ms: number | null;
          error: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          dealership_id: string;
          conversation_id: string;
          message_id: string;
          prompt_version: string;
          model: string;
          structured_output?: Json;
          latency_ms?: number | null;
          error?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          dealership_id?: string;
          conversation_id?: string;
          message_id?: string;
          prompt_version?: string;
          model?: string;
          structured_output?: Json;
          latency_ms?: number | null;
          error?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "message_ai_runs_dealership_id_fkey";
            columns: ["dealership_id"];
            isOneToOne: false;
            referencedRelation: "dealerships";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "message_ai_runs_conversation_id_fkey";
            columns: ["conversation_id"];
            isOneToOne: false;
            referencedRelation: "conversations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "message_ai_runs_message_id_fkey";
            columns: ["message_id"];
            isOneToOne: false;
            referencedRelation: "messages";
            referencedColumns: ["id"];
          },
        ];
      };
      lead_offers: {
        Row: {
          id: string;
          dealership_id: string;
          name: string;
          description: string;
          is_active: boolean;
          department: StaffDepartment;
          priority: number;
          starts_at: string | null;
          ends_at: string | null;
          cta_text: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          dealership_id: string;
          name: string;
          description?: string;
          is_active?: boolean;
          department?: StaffDepartment;
          priority?: number;
          starts_at?: string | null;
          ends_at?: string | null;
          cta_text?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          dealership_id?: string;
          name?: string;
          description?: string;
          is_active?: boolean;
          department?: StaffDepartment;
          priority?: number;
          starts_at?: string | null;
          ends_at?: string | null;
          cta_text?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "lead_offers_dealership_id_fkey";
            columns: ["dealership_id"];
            isOneToOne: false;
            referencedRelation: "dealerships";
            referencedColumns: ["id"];
          },
        ];
      };
      lead_offer_events: {
        Row: {
          id: string;
          dealership_id: string;
          offer_id: string;
          conversation_id: string | null;
          event_type: LeadOfferEventType;
          created_at: string;
        };
        Insert: {
          id?: string;
          dealership_id: string;
          offer_id: string;
          conversation_id?: string | null;
          event_type: LeadOfferEventType;
          created_at?: string;
        };
        Update: {
          id?: string;
          dealership_id?: string;
          offer_id?: string;
          conversation_id?: string | null;
          event_type?: LeadOfferEventType;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "lead_offer_events_dealership_id_fkey";
            columns: ["dealership_id"];
            isOneToOne: false;
            referencedRelation: "dealerships";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "lead_offer_events_offer_id_fkey";
            columns: ["offer_id"];
            isOneToOne: false;
            referencedRelation: "lead_offers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "lead_offer_events_conversation_id_fkey";
            columns: ["conversation_id"];
            isOneToOne: false;
            referencedRelation: "conversations";
            referencedColumns: ["id"];
          },
        ];
      };
      appointments: {
        Row: {
          id: string;
          dealership_id: string;
          conversation_id: string;
          customer_id: string | null;
          department: AppointmentDepartment;
          status: AppointmentStatus;
          proposed_datetime: string | null;
          confirmed_datetime: string | null;
          assigned_user_id: string | null;
          booked_by_user_id: string | null;
          vehicle_interest: string | null;
          notes: string | null;
          source: AppointmentSource;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          dealership_id: string;
          conversation_id: string;
          customer_id?: string | null;
          department: AppointmentDepartment;
          status?: AppointmentStatus;
          proposed_datetime?: string | null;
          confirmed_datetime?: string | null;
          assigned_user_id?: string | null;
          booked_by_user_id?: string | null;
          vehicle_interest?: string | null;
          notes?: string | null;
          source?: AppointmentSource;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          dealership_id?: string;
          conversation_id?: string;
          customer_id?: string | null;
          department?: AppointmentDepartment;
          status?: AppointmentStatus;
          proposed_datetime?: string | null;
          confirmed_datetime?: string | null;
          assigned_user_id?: string | null;
          booked_by_user_id?: string | null;
          vehicle_interest?: string | null;
          notes?: string | null;
          source?: AppointmentSource;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "appointments_dealership_id_fkey";
            columns: ["dealership_id"];
            isOneToOne: false;
            referencedRelation: "dealerships";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "appointments_conversation_id_fkey";
            columns: ["conversation_id"];
            isOneToOne: false;
            referencedRelation: "conversations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "appointments_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "appointments_assigned_user_id_fkey";
            columns: ["assigned_user_id"];
            isOneToOne: false;
            referencedRelation: "staff_users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "appointments_booked_by_user_id_fkey";
            columns: ["booked_by_user_id"];
            isOneToOne: false;
            referencedRelation: "staff_users";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      user_has_dealership_access: {
        Args: { p_dealership_id: string };
        Returns: boolean;
      };
      user_has_dealership_write_access: {
        Args: { p_dealership_id: string };
        Returns: boolean;
      };
      current_staff_is_privileged: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      inbox_latest_message_previews_for_dealership: {
        Args: { p_dealership_id: string; p_conversation_ids: string[] };
        Returns: {
          conversation_id: string;
          body: string;
          created_at: string;
        }[];
      };
      assign_conversation: {
        Args: {
          p_dealership_id: string;
          p_conversation_id: string;
          p_assigned_to_user_id: string;
          p_assigned_by_user_id: string | null;
          p_note: string | null;
        };
        Returns: {
          id: string;
          dealership_id: string;
          customer_id: string | null;
          channel: ConversationChannel;
          department: StaffDepartment;
          status: ConversationStatus;
          priority: ConversationPriority;
          sentiment: Sentiment;
          ai_enabled: boolean;
          assigned_to_user_id: string | null;
          last_message_at: string | null;
          title: string | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
      };
      claim_conversation: {
        Args: {
          p_dealership_id: string;
          p_conversation_id: string;
          p_staff_user_id: string;
          p_takeover: boolean;
        };
        Returns: {
          id: string;
          dealership_id: string;
          customer_id: string | null;
          channel: ConversationChannel;
          department: StaffDepartment;
          status: ConversationStatus;
          priority: ConversationPriority;
          sentiment: Sentiment;
          ai_enabled: boolean;
          assigned_to_user_id: string | null;
          last_message_at: string | null;
          title: string | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
      };
      staff_delete_conversations: {
        Args: {
          p_dealership_id: string;
          p_conversation_ids: string[];
        };
        Returns: number;
      };
      set_conversation_status: {
        Args: {
          p_dealership_id: string;
          p_conversation_id: string;
          p_next_status: ConversationStatus;
          p_actor_user_id: string;
          p_reason: string | null;
        };
        Returns: {
          id: string;
          dealership_id: string;
          customer_id: string | null;
          channel: ConversationChannel;
          department: StaffDepartment;
          status: ConversationStatus;
          priority: ConversationPriority;
          sentiment: Sentiment;
          ai_enabled: boolean;
          assigned_to_user_id: string | null;
          last_message_at: string | null;
          title: string | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
      };
    };
    Enums: {
      staff_role: StaffRole;
      staff_department: StaffDepartment;
      conversation_channel: ConversationChannel;
      conversation_status: ConversationStatus;
      conversation_priority: ConversationPriority;
      sentiment: Sentiment;
      message_sender_type: MessageSenderType;
      message_delivery_status: MessageDeliveryStatus;
      conversation_event_type: ConversationEventType;
      social_engagement_handling_state: SocialEngagementHandlingState;
      lead_offer_event_type: LeadOfferEventType;
      appointment_department: AppointmentDepartment;
      appointment_status: AppointmentStatus;
      appointment_source: AppointmentSource;
    };
    CompositeTypes: Record<string, never>;
  };
};
