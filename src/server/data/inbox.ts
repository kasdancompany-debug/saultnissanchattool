import type { Json, Tables } from "@/integrations/supabase/database.types";
import {
  getConversationById,
  listInboxConversationEntries,
  type ConversationListEntry,
} from "@/server/data/conversation-queries";
import { resolveDb } from "@/server/data/internal";
import {
  getMessagesForConversation,
  type ConversationMessageForChatUi,
} from "@/server/data/messages";
import { getLatestMessageAiRunForConversation } from "@/server/data/message-ai-runs";
import type { TypedSupabaseClient } from "@/server/db/server-client";
import { buildAiAssistPanelView } from "@/server/inbox/build-ai-assist-panel-view";
import { buildAiCopilotView } from "@/server/inbox/build-ai-copilot-view";
import type { AiAssistPanelView } from "@/types/ai-assist-panel";
import type { AiCopilotView } from "@/types/ai-copilot";
import { resolveConversationHandlingMode } from "@/lib/conversation/control-metadata";
import { readAiInsightsFromMetadata } from "@/lib/conversation/ai-insights-metadata";
import { resolveEffectiveCustomerProfile } from "@/lib/conversation/resolve-effective-customer-profile";
import {
  getCustomerDisplayName,
  type InboxConversationListItem,
} from "@/lib/inbox/inbox-list-item";
import { isAfterHoursWebChatIntake } from "@/lib/conversation/widget-metadata";
import { syncCustomerProfileFromConversationThread } from "@/server/conversation/sync-customer-profile-from-inbound";
import { getCustomerById } from "@/server/data/customers";
import type { InboxFilter } from "@/lib/inbox/inbox-filter";
import {
  applyInboxSort,
  DEFAULT_INBOX_SORT,
  type InboxSort,
} from "@/lib/inbox/inbox-sort";
import { computeOpportunityScore } from "@/lib/opportunity/compute-opportunity";
import { readOpportunityFromMetadata } from "@/lib/opportunity/metadata";
import type { MessageSenderType } from "@/integrations/supabase/database.types";
import type { OpportunitySnapshot } from "@/lib/opportunity/types";
import {
  buildInboxCardContext,
  computeUnreadFromMessageRows,
  type MessageMetaRow,
} from "@/lib/inbox/conversation-card";
import type { InboxConversationCardContext } from "@/lib/inbox/conversation-card";
import { resolveInboxChannelSurface } from "@/lib/conversation/inbox-channel-surface";
import { ok, type Result } from "@/server/result";

export type { InboxFilter } from "@/lib/inbox/inbox-filter";

/** Shown when conversations.assigned_to_user_id points to a missing staff_users row. */
const UNKNOWN_ASSIGNEE_NAME = "Unknown teammate";

export type { InboxConversationListItem } from "@/lib/inbox/inbox-list-item";
export { getCustomerDisplayName } from "@/lib/inbox/inbox-list-item";
export type { InboxMessageView } from "@/lib/inbox/inbox-message-view";
import type { InboxMessageView } from "@/lib/inbox/inbox-message-view";

export type InboxThreadData = {
  conversation: Tables<"conversations"> & {
    customers: InboxConversationListItem["customers"];
  };
  messages: InboxMessageView[];
  customer_display_name: string;
  /** Profile fields for the center form — matches Insights (chat + CRM + AI). */
  customer_profile: {
    displayName: string;
    email: string | null;
    phoneE164: string | null;
  };
  assignee: {
    id: string;
    display_name: string;
    email: string;
  } | null;
  /** Short line for thread header (human vs AI assist). */
  workflow_caption: string;
  /** Latest AI classification for the inbox assist panel (server-built view). */
  ai_assist_panel: AiAssistPanelView | null;
  /** Right-side AI Copilot drawer content. */
  ai_copilot: AiCopilotView;
};

/**
 * PostgREST embeds may return a single object or a one-element array depending on
 * relationship metadata. Normalize so UI always sees one shape or null.
 */
export function normalizeCustomersEmbed(
  raw: unknown
): InboxConversationListItem["customers"] {
  if (raw == null) {
    return null;
  }
  if (Array.isArray(raw)) {
    const first = raw[0];
    if (first && typeof first === "object" && !Array.isArray(first)) {
      return first as InboxConversationListItem["customers"];
    }
    return null;
  }
  if (typeof raw === "object") {
    return raw as InboxConversationListItem["customers"];
  }
  return null;
}

function resolveOpportunityForListItem(
  entry: ConversationListEntry,
  last_message_preview: { body: string; created_at: string } | null
): OpportunitySnapshot {
  const stored = readOpportunityFromMetadata(entry.metadata);
  if (stored) return stored;

  return computeOpportunityScore({
    messageText: last_message_preview?.body ?? entry.title ?? "",
    classification: null,
    conversationMetadata: entry.metadata,
    status: entry.status,
    department: entry.department,
  });
}

async function buildMessageMetaMap(
  supabase: TypedSupabaseClient,
  convIds: string[]
): Promise<Map<string, { unreadCount: number; lastSender: MessageSenderType | null }>> {
  if (convIds.length === 0) {
    return new Map();
  }

  const limit = Math.min(Math.max(convIds.length * 80, 200), 25_000);
  const { data, error } = await supabase
    .from("messages")
    .select("conversation_id, sender_type, created_at")
    .in("conversation_id", convIds)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error || !data) {
    return new Map();
  }

  return computeUnreadFromMessageRows(data as MessageMetaRow[]);
}

function conversationListEntryToInboxItem(
  entry: ConversationListEntry,
  last_message_preview: { body: string; created_at: string } | null,
  messageMeta: { unreadCount: number; lastSender: MessageSenderType | null } | undefined,
  currentStaffUserId: string
): InboxConversationListItem {
  const { customer, assignee, ...rest } = entry;
  const assigneeOut =
    rest.assigned_to_user_id != null
      ? assignee ?? {
          id: rest.assigned_to_user_id,
          display_name: UNKNOWN_ASSIGNEE_NAME,
          email: "",
        }
      : null;

  const channelSurface = resolveInboxChannelSurface({
    channel: rest.channel,
    metadata: rest.metadata,
    title: rest.title,
  });

  const opportunity = resolveOpportunityForListItem(entry, last_message_preview);

  return {
    ...rest,
    customers: customer
      ? {
          display_name: customer.display_name,
          email: customer.email,
          phone_e164: customer.phone_e164,
        }
      : null,
    assignee: assigneeOut,
    last_message_preview,
    opportunity,
    card: buildInboxCardContext({
      status: rest.status,
      department: rest.department,
      metadata: rest.metadata,
      createdAtIso: rest.created_at,
      sentiment: rest.sentiment,
      assignee: assigneeOut,
      lastMessagePreview: last_message_preview,
      channelSurface,
      currentStaffUserId,
      lastMessageSender: messageMeta?.lastSender ?? null,
      unreadCount: messageMeta?.unreadCount ?? 0,
    }),
  };
}

async function buildLastMessagePreviewMap(
  supabase: TypedSupabaseClient,
  dealershipId: string,
  convIds: string[]
): Promise<Map<string, { body: string; created_at: string }>> {
  const previewMap = new Map<string, { body: string; created_at: string }>();
  if (convIds.length === 0) {
    return previewMap;
  }

  const { data: rpcPreviews, error: rpcErr } = await supabase.rpc(
    "inbox_latest_message_previews_for_dealership",
    {
      p_dealership_id: dealershipId,
      p_conversation_ids: convIds,
    }
  );

  type PreviewRow = {
    conversation_id: string;
    body: string | null;
    created_at: string;
  };

  const previewRpcRows: PreviewRow[] =
    rpcPreviews == null
      ? []
      : Array.isArray(rpcPreviews)
        ? (rpcPreviews as PreviewRow[])
        : [rpcPreviews as PreviewRow];

  if (!rpcErr && rpcPreviews != null) {
    for (const row of previewRpcRows) {
      if (row?.conversation_id) {
        previewMap.set(row.conversation_id, {
          body: (row.body ?? "").slice(0, 160),
          created_at: row.created_at,
        });
      }
    }
  } else {
    if (rpcErr && process.env.NODE_ENV === "development") {
      console.warn(
        "[inbox] preview RPC unavailable (apply migrations?), using fallback:",
        rpcErr.message
      );
    }

    const previewLimit = Math.min(Math.max(convIds.length * 40, 100), 10_000);

    const { data: recentMsgs, error: msgErr } = await supabase
      .from("messages")
      .select("conversation_id, body, created_at")
      .in("conversation_id", convIds)
      .order("created_at", { ascending: false })
      .limit(previewLimit);

    if (msgErr && process.env.NODE_ENV === "development") {
      console.warn("[inbox] message preview fallback failed:", msgErr.message);
    }

    if (!msgErr && recentMsgs) {
      for (const m of recentMsgs) {
        if (!previewMap.has(m.conversation_id)) {
          previewMap.set(m.conversation_id, {
            body: (m.body ?? "").slice(0, 160),
            created_at: m.created_at,
          });
        }
      }
    }
  }

  return previewMap;
}

export async function listInboxConversations(
  dealershipId: string,
  filter: InboxFilter,
  currentStaffUserId: string,
  canViewDealershipWide: boolean,
  assigneeScopeUserId: string | null,
  sort: InboxSort = DEFAULT_INBOX_SORT,
  db?: TypedSupabaseClient
): Promise<Result<InboxConversationListItem[]>> {
  const supabase = await resolveDb(db);
  const entriesRes = await listInboxConversationEntries(
    dealershipId,
    filter,
    currentStaffUserId,
    canViewDealershipWide,
    { db: supabase, assigneeScopeUserId }
  );
  if (!entriesRes.ok) {
    return entriesRes;
  }

  const entries = entriesRes.data;
  const convIds = entries.map((e) => e.id);
  const [previewMap, messageMetaMap] = await Promise.all([
    buildLastMessagePreviewMap(supabase, dealershipId, convIds),
    buildMessageMetaMap(supabase, convIds),
  ]);

  const items: InboxConversationListItem[] = [];
  for (const e of entries) {
    try {
      items.push(
        conversationListEntryToInboxItem(
          e,
          previewMap.get(e.id) ?? null,
          messageMetaMap.get(e.id),
          currentStaffUserId
        )
      );
    } catch (mapErr) {
      console.error("[inbox] skip list row after map error", e.id, mapErr);
    }
  }

  return ok(applyInboxSort(items, sort));
}

function chatUiMessagesToInboxViews(
  rows: ConversationMessageForChatUi[],
  customerDisplayName: string
): InboxMessageView[] {
  return rows.map((m) => {
    let sender_label = "Unknown";
    if (m.sender_type === "customer") {
      sender_label = customerDisplayName;
    } else if (m.sender_type === "staff") {
      sender_label = m.staff_display_name ?? "Staff";
    } else if (m.sender_type === "system") {
      sender_label = "System";
    } else if (m.sender_type === "ai") {
      sender_label = "AI assistant";
    }

    const full: InboxMessageView = {
      id: m.id,
      conversation_id: m.conversation_id,
      sender_type: m.sender_type,
      sender_user_id: m.sender_user_id,
      body: m.body,
      raw_payload: {} as Json,
      delivery_status: m.delivery_status,
      metadata: m.metadata,
      twilio_inbound_sid: null,
      twilio_outbound_sid: m.twilio_outbound_sid,
      created_at: m.created_at,
      updated_at: m.updated_at,
      sender_label,
    };
    return full;
  });
}

export async function getInboxThread(
  dealershipId: string,
  conversationId: string,
  db?: TypedSupabaseClient
): Promise<Result<InboxThreadData>> {
  const supabase = await resolveDb(db);

  const detailRes = await getConversationById(dealershipId, conversationId, {
    db: supabase,
  });
  if (!detailRes.ok) {
    return detailRes;
  }
  const detail = detailRes.data;

  const { customer, assignee: detailAssignee, ...convFields } = detail;
  const customers = customer
    ? {
        display_name: customer.display_name,
        email: customer.email,
        phone_e164: customer.phone_e164,
      }
    : null;
  const convRow: Tables<"conversations"> & {
    customers: InboxConversationListItem["customers"];
  } = {
    ...convFields,
    customers,
  };

  const customer_display_name = getCustomerDisplayName(customers, convRow.title);

  const assignee =
    detail.assigned_to_user_id != null
      ? detailAssignee ?? {
          id: detail.assigned_to_user_id,
          display_name: UNKNOWN_ASSIGNEE_NAME,
          email: "",
        }
      : null;

  const [msgsRes, aiRes] = await Promise.all([
    getMessagesForConversation(dealershipId, conversationId, {
      limit: 500,
      db: supabase,
    }),
    getLatestMessageAiRunForConversation(
      dealershipId,
      conversationId,
      supabase
    ),
  ]);
  if (!msgsRes.ok) {
    return msgsRes;
  }

  try {
    await syncCustomerProfileFromConversationThread(
      dealershipId,
      conversationId,
      supabase
    );
  } catch (syncErr) {
    console.error(
      "[inbox] syncCustomerProfileFromConversationThread failed",
      conversationId,
      syncErr
    );
  }

  let syncedCustomers = customers;
  const customerId = detail.customer_id?.trim();
  if (customerId) {
    const refreshed = await getCustomerById(dealershipId, customerId, supabase);
    if (refreshed.ok) {
      syncedCustomers = {
        display_name: refreshed.data.display_name,
        email: refreshed.data.email,
        phone_e164: refreshed.data.phone_e164,
      };
    }
  }

  const latest_ai_assist = aiRes.ok ? aiRes.data : null;
  const ai_assist_panel = buildAiAssistPanelView(latest_ai_assist);

  const customerBodies = msgsRes.data
    .filter((m) => m.sender_type === "customer")
    .map((m) => (m.body ?? "").trim())
    .filter(Boolean);

  const aiInsights = readAiInsightsFromMetadata(convRow.metadata);
  const effectiveProfile = resolveEffectiveCustomerProfile({
    displayName: getCustomerDisplayName(syncedCustomers, convRow.title),
    email: syncedCustomers?.email ?? null,
    phoneE164: syncedCustomers?.phone_e164 ?? null,
    customerMessageBodies: customerBodies,
    aiInsightsProfile: aiInsights?.customer_profile ?? null,
  });

  const customer_display_name_resolved = effectiveProfile.displayName;
  const enriched = chatUiMessagesToInboxViews(
    msgsRes.data,
    customer_display_name_resolved
  );

  const ai_copilot = buildAiCopilotView({
    customerDisplayName: customer_display_name_resolved,
    customerEmail: effectiveProfile.email,
    customerPhoneE164: effectiveProfile.phoneE164,
    messages: enriched,
    conversationMetadata: convRow.metadata,
    department: convRow.department,
    status: convRow.status,
    assist: ai_assist_panel,
    hasAssignee: assignee != null,
  });

  return ok({
    conversation: {
      ...convRow,
      customers: syncedCustomers,
    },
    messages: enriched,
    customer_display_name: customer_display_name_resolved,
    customer_profile: {
      displayName: effectiveProfile.displayName,
      email: effectiveProfile.email,
      phoneE164: effectiveProfile.phoneE164,
    },
    assignee,
    workflow_caption: buildWorkflowCaption(convRow),
    ai_assist_panel,
    ai_copilot,
  });
}

export function buildWorkflowCaption(conv: Tables<"conversations">): string {
  const afterHours = isAfterHoursWebChatIntake(conv.metadata);
  const handling = resolveConversationHandlingMode(conv.metadata, conv.status);
  const prefix = afterHours ? "After-hours intake · " : "";

  if (handling === "claimed_by_staff") {
    const base = conv.ai_enabled
      ? "Human control · AI assist-only (no auto-send)"
      : "Human control · AI off";
    return `${prefix}${base}`;
  }

  if (handling === "waiting_for_human") {
    const base = conv.ai_enabled
      ? "Needs human · AI may still suggest drafts"
      : "Needs human · claim to respond";
    return `${prefix}${base}`;
  }

  if (!conv.assigned_to_user_id) {
    const base = conv.ai_enabled
      ? "Unassigned · AI triage on"
      : "Unassigned — claim to take ownership";
    return `${prefix}${base}`;
  }

  const tail = conv.ai_enabled
    ? "Assigned · AI triage on until a human takes over"
    : "Assigned — human control";
  return `${prefix}${tail}`;
}

