/**
 * Public web widget backend: start `web_chat` threads, post customer messages, poll messages.
 * Responses and DB reads expose only widget-safe fields; service-role writes enforce dealership scope.
 */
import "server-only";

import type {
  Json,
  StaffDepartment,
} from "@/integrations/supabase/database.types";
import { createSupabaseAdminClient } from "@/integrations/supabase/admin";
import { parseBusinessHoursConfig } from "@/lib/business-hours/parse-config";
import { createConversation } from "@/server/data/conversations";
import {
  createAnonymousWebCustomer,
  getCustomerById,
  getOrCreateCustomerByPhoneOrEmail,
} from "@/server/data/customers";
import { insertConversationEvent } from "@/server/data/conversation-events";
import { getConversationRowById } from "@/server/data/conversations";
import { webChatInboundAdapter } from "@/server/inbox/adapters/web-chat.adapter";
import { err, ok, type Result } from "@/server/result";

import { evaluateLiveHours } from "@/lib/business-hours";
import {
  ensureDevWidgetDealershipBundle,
  getDealershipWidgetBundleBySlug,
  getFirstDealershipWidgetBundle,
} from "@/server/data/dealership-business-hours";
import {
  buildLeadCaptureSummaryMessage,
  buildLeadConversationTitle,
} from "@/lib/widget/lead-capture/build-summary";
import { computeOpportunityScore } from "@/lib/opportunity/compute-opportunity";
import { mergeOpportunityMetadata } from "@/lib/opportunity/metadata";
import { mergeLeadIntoConversationMetadata } from "@/lib/widget/lead-capture/metadata";
import { inferDepartmentFromPagePath } from "@/lib/widget/infer-department";
import { signWidgetSessionToken } from "@/lib/widget/session-token";
import {
  departmentForLeadIntent,
  type WidgetLeadCaptureInput,
} from "@/server/widget/lead-capture-schema";

export type WidgetPublicMessage = {
  id: string;
  body: string;
  created_at: string;
  sender: "customer" | "staff" | "system" | "ai";
};

function mapWidgetPublicSender(
  raw: string
): WidgetPublicMessage["sender"] {
  if (
    raw === "customer" ||
    raw === "staff" ||
    raw === "system" ||
    raw === "ai"
  ) {
    return raw;
  }
  return "system";
}

export type StartWidgetConversationInput = {
  dealershipSlug: string;
  /** Explicit department wins over inference. */
  department?: StaffDepartment | null;
  pagePath?: string | null;
  displayName?: string | null;
  email?: string | null;
  /** E.164 */
  phoneE164?: string | null;
  userAgent?: string | null;
  leadCapture?: WidgetLeadCaptureInput | null;
};

export type StartWidgetConversationResult = {
  conversation_id: string;
  session_token: string;
  expires_at: string;
  live_hours: {
    within_live_hours: boolean;
    after_hours: boolean;
    timezone: string;
    schedule_key: string;
    evaluated_at: string;
  };
};

async function resolveWidgetBundleForSlug(slug: string) {
  const requestedSlug = slug.trim().toLowerCase();
  const defaultTimezone = "America/Toronto";
  const defaultBusinessHours = parseBusinessHoursConfig({}, defaultTimezone);
  const helperBundle = await getDealershipWidgetBundleBySlug(requestedSlug);
  if (helperBundle) {
    return helperBundle;
  }

  // More resilient than maybeSingle: handles duplicate slug rows gracefully.
  const supabase = createSupabaseAdminClient();
  const bySlug = await supabase
    .from("dealerships")
    .select("id, name, slug, timezone, business_hours")
    .eq("slug", requestedSlug)
    .order("created_at", { ascending: true })
    .limit(1);

  const bySlugRow = bySlug.data?.[0];
  if (bySlugRow?.id) {
    return {
      dealershipId: bySlugRow.id,
      name: bySlugRow.name,
      slug: bySlugRow.slug ?? requestedSlug,
      timezone: bySlugRow.timezone,
      businessHours: parseBusinessHoursConfig(
        bySlugRow.business_hours as Json,
        bySlugRow.timezone
      ),
    };
  }

  // Legacy schema fallback: older DBs may not include widget hour columns yet.
  const bySlugLegacy = await supabase
    .from("dealerships")
    .select("id, name, slug")
    .eq("slug", requestedSlug)
    .order("created_at", { ascending: true })
    .limit(1);
  const bySlugLegacyRow = bySlugLegacy.data?.[0];
  if (bySlugLegacyRow?.id) {
    return {
      dealershipId: bySlugLegacyRow.id,
      name: bySlugLegacyRow.name,
      slug: bySlugLegacyRow.slug ?? requestedSlug,
      timezone: defaultTimezone,
      businessHours: defaultBusinessHours,
    };
  }

  if (process.env.NODE_ENV === "production") {
    return null;
  }

  const first = await getFirstDealershipWidgetBundle();
  if (first) {
    return first;
  }

  const firstLegacy = await supabase
    .from("dealerships")
    .select("id, name, slug")
    .order("created_at", { ascending: true })
    .limit(1);
  const firstLegacyRow = firstLegacy.data?.[0];
  if (firstLegacyRow?.id) {
    return {
      dealershipId: firstLegacyRow.id,
      name: firstLegacyRow.name,
      slug: firstLegacyRow.slug ?? requestedSlug,
      timezone: defaultTimezone,
      businessHours: defaultBusinessHours,
    };
  }

  return ensureDevWidgetDealershipBundle(requestedSlug);
}

async function buildDealershipNotFoundMessage(slug: string): Promise<string> {
  if (process.env.NODE_ENV === "production") {
    return "Dealership not found.";
  }

  try {
    const supabase = createSupabaseAdminClient();
    const probe = await supabase
      .from("dealerships")
      .select("id, slug")
      .order("created_at", { ascending: true })
      .limit(5);

    const slugs = (probe.data ?? [])
      .map((row) => row.slug || "(null)")
      .join(", ");
    return `Dealership not found. debug: requested=${slug}; node_env=${process.env.NODE_ENV}; sample_slugs=[${slugs || "none"}]`;
  } catch (error) {
    return `Dealership not found. debug: requested=${slug}; node_env=${process.env.NODE_ENV}; probe_failed=${error instanceof Error ? error.message : "unknown"}`;
  }
}

/**
 * Resolves dealership by public slug (must be non-null in DB for this API).
 */
export async function resolveDealershipIdBySlug(
  slug: string
): Promise<Result<{ id: string; name: string }>> {
  const bundle = await resolveWidgetBundleForSlug(slug);
  if (!bundle) {
    return err("NOT_FOUND", await buildDealershipNotFoundMessage(slug));
  }
  return ok({ id: bundle.dealershipId, name: bundle.name });
}

export async function startWidgetConversation(
  input: StartWidgetConversationInput,
  sessionSecret: string
): Promise<Result<StartWidgetConversationResult>> {
  const slug = input.dealershipSlug.trim().toLowerCase();
  const bundle = await resolveWidgetBundleForSlug(slug);
  if (!bundle) {
    return err("NOT_FOUND", await buildDealershipNotFoundMessage(slug));
  }

  const dealershipId = bundle.dealershipId;
  const supabase = createSupabaseAdminClient();

  const lead = input.leadCapture ?? null;

  let customerId: string | null = null;
  const phone =
    lead?.phone_e164?.trim() || input.phoneE164?.trim() || null;
  const email =
    lead?.email?.trim().toLowerCase() || input.email?.trim().toLowerCase() || null;
  const displayName =
    lead?.name?.trim() || input.displayName?.trim() || null;

  if (phone || email) {
    const cust = await getOrCreateCustomerByPhoneOrEmail(
      {
        dealershipId,
        phoneE164: phone,
        email,
        displayName,
      },
      supabase
    );
    if (!cust.ok) {
      return cust;
    }
    customerId = cust.data.id;
  } else {
    const anon = await createAnonymousWebCustomer(
      dealershipId,
      {
        displayName,
        metadata: {
          page_path: input.pagePath ?? null,
          ...(lead ? { lead_capture: lead } : {}),
        },
        db: supabase,
      }
    );
    if (!anon.ok) {
      return anon;
    }
    customerId = anon.data.id;
  }

  const department =
    input.department ??
    (lead ? departmentForLeadIntent(lead.intent) : null) ??
    inferDepartmentFromPagePath(input.pagePath ?? undefined);

  const live = evaluateLiveHours(bundle.businessHours, department, new Date());

  const ua = input.userAgent?.slice(0, 200) ?? null;

  const baseMetadata: Json = {
    widget: {
      page_path: input.pagePath ?? null,
      user_agent_snippet: ua,
      after_hours: live.after_hours,
      live_hours_evaluated_at: live.evaluated_at,
      timezone: live.timezone,
      schedule_key: live.schedule_key,
    },
  };

  const conv = await createConversation(
    {
      dealershipId,
      customerId,
      channel: "web_chat",
      department,
      aiEnabled: true,
      title: lead
        ? buildLeadConversationTitle(lead)
        : displayName
          ? `Web chat — ${displayName}`
          : "Web chat",
      metadata: lead
        ? mergeLeadIntoConversationMetadata(baseMetadata, lead)
        : baseMetadata,
    },
    supabase
  );

  if (!conv.ok) {
    return conv;
  }

  const conversation = conv.data;

  if (lead) {
    const opportunity = computeOpportunityScore({
      messageText: buildLeadCaptureSummaryMessage(lead),
      classification: null,
      conversationMetadata: conversation.metadata,
      status: conversation.status,
      department,
    });
    await supabase
      .from("conversations")
      .update({
        metadata: mergeOpportunityMetadata(conversation.metadata, opportunity),
        updated_at: new Date().toISOString(),
      })
      .eq("id", conversation.id)
      .eq("dealership_id", dealershipId);
  }

  const sessionEv = await insertConversationEvent(supabase, {
    conversation_id: conversation.id,
    event_type: "conversation_created",
    actor_user_id: null,
    payload: {
      source: "web_widget",
      channel: "web_chat",
      department,
      /** Distinct from other `conversation_created` sources (SMS, telephony, etc.). */
      kind: "widget_session_started",
      customer_id: customerId,
      after_hours: live.after_hours,
      timezone: live.timezone,
      schedule_key: live.schedule_key,
      evaluated_at: live.evaluated_at,
    },
  });

  if (!sessionEv.ok) {
    return err(sessionEv.error.code, sessionEv.error.message);
  }

  if (live.after_hours) {
    const afterHoursEv = await insertConversationEvent(supabase, {
      conversation_id: conversation.id,
      event_type: "after_hours_intake",
      actor_user_id: null,
      payload: {
        source: "web_widget",
        channel: "web_chat",
        department,
        kind: "after_hours_web_chat_started",
        timezone: live.timezone,
        schedule_key: live.schedule_key,
        evaluated_at: live.evaluated_at,
      },
    });

    if (!afterHoursEv.ok) {
      return err(afterHoursEv.error.code, afterHoursEv.error.message);
    }
  }

  if (lead) {
    const summary = buildLeadCaptureSummaryMessage(lead);
    const ingestRes = await webChatInboundAdapter.ingest(
      {
        dealershipId,
        conversationId: conversation.id,
        body: summary,
        customerDisplayName: displayName ?? "Website visitor",
      },
      supabase
    );
    if (!ingestRes.ok) {
      return ingestRes;
    }
  }

  const ttlSeconds = 7 * 24 * 60 * 60;
  const expMs = Date.now() + ttlSeconds * 1000;
  const session_token = signWidgetSessionToken(
    {
      conversationId: conversation.id,
      dealershipId,
      ttlSeconds,
    },
    sessionSecret
  );

  return ok({
    conversation_id: conversation.id,
    session_token,
    expires_at: new Date(expMs).toISOString(),
    live_hours: {
      within_live_hours: live.within_live_hours,
      after_hours: live.after_hours,
      timezone: live.timezone,
      schedule_key: live.schedule_key,
      evaluated_at: live.evaluated_at,
    },
  });
}

export async function postWidgetCustomerMessage(input: {
  dealershipId: string;
  conversationId: string;
  body: string;
}): Promise<Result<{ id: string; created_at: string }>> {
  const supabase = createSupabaseAdminClient();

  const conv = await getConversationRowById(
    input.dealershipId,
    input.conversationId,
    supabase
  );
  if (!conv.ok) {
    return conv;
  }
  if (conv.data.channel !== "web_chat") {
    return err("NOT_FOUND", "Conversation not found.");
  }

  let customerName = "Website visitor";
  if (conv.data.customer_id) {
    const cust = await getCustomerById(
      input.dealershipId,
      conv.data.customer_id,
      supabase
    );
    if (cust.ok) {
      customerName = cust.data.display_name?.trim() || customerName;
    }
  }

  const ingestRes = await webChatInboundAdapter.ingest(
    {
      dealershipId: input.dealershipId,
      conversationId: input.conversationId,
      body: input.body,
      customerDisplayName: customerName,
    },
    supabase
  );

  if (!ingestRes.ok) {
    return ingestRes;
  }
  if (ingestRes.data.kind === "duplicate") {
    return err("CONFLICT", "Duplicate message.");
  }

  return ok({
    id: ingestRes.data.messageId,
    created_at: ingestRes.data.createdAt,
  });
}

export async function listWidgetMessages(input: {
  dealershipId: string;
  conversationId: string;
  limit?: number;
}): Promise<Result<WidgetPublicMessage[]>> {
  const supabase = createSupabaseAdminClient();
  const lim = Math.min(input.limit ?? 100, 200);

  const convCheck = await supabase
    .from("conversations")
    .select("id, channel")
    .eq("id", input.conversationId)
    .eq("dealership_id", input.dealershipId)
    .maybeSingle();

  if (convCheck.error) {
    return err("DB_ERROR", convCheck.error.message);
  }
  if (!convCheck.data || convCheck.data.channel !== "web_chat") {
    return err("NOT_FOUND", "Conversation not found.");
  }

  const res = await supabase
    .from("messages")
    .select("id, body, created_at, sender_type")
    .eq("conversation_id", input.conversationId)
    .order("created_at", { ascending: true })
    .limit(lim);

  if (res.error) {
    return err("DB_ERROR", res.error.message);
  }

  const rows = res.data ?? [];

  const mapped: WidgetPublicMessage[] = rows.map((r) => ({
    id: r.id,
    body: r.body,
    created_at: r.created_at,
    sender: mapWidgetPublicSender(r.sender_type),
  }));

  return ok(mapped);
}
