import { parseDealershipSettingsV1 } from "@/lib/settings/dealership-settings-v1";
import {
  messageBodyIncludesSchedulerUrl,
  resolveServiceSchedulerPublicConfig,
  type ServiceSchedulerPublicConfig,
} from "@/lib/service-scheduler/service-scheduler-message";
import { insertConversationEvent } from "@/server/data/conversation-events";
import { getConversationRowById } from "@/server/data/conversations";
import { resolveDb } from "@/server/data/internal";
import { fromPostgrestError } from "@/server/data/postgrest-error";
import type { TypedSupabaseClient } from "@/server/db/server-client";
import { err, ok, type Result } from "@/server/result";

export async function loadServiceSchedulerConfigForDealership(
  dealershipId: string,
  db?: TypedSupabaseClient
): Promise<Result<ServiceSchedulerPublicConfig | null>> {
  const supabase = await resolveDb(db);
  const res = await supabase
    .from("dealerships")
    .select("metadata")
    .eq("id", dealershipId)
    .single();

  if (res.error) {
    return fromPostgrestError(res.error);
  }

  const settings = parseDealershipSettingsV1(res.data.metadata);
  return ok(resolveServiceSchedulerPublicConfig(settings.service_scheduling));
}

export async function recordServiceSchedulerLinkSent(
  supabase: TypedSupabaseClient,
  params: {
    conversationId: string;
    staffUserId: string;
    url: string;
  }
): Promise<Result<void>> {
  const timestamp = new Date().toISOString();
  return insertConversationEvent(supabase, {
    conversation_id: params.conversationId,
    event_type: "service_scheduler_link_sent",
    actor_user_id: params.staffUserId,
    payload: {
      url: params.url,
      timestamp,
      sent_by_user_id: params.staffUserId,
    },
  });
}

export async function insertServiceSchedulerLinkForConversation(
  dealershipId: string,
  conversationId: string,
  staffUserId: string,
  db?: TypedSupabaseClient
): Promise<Result<{ messageText: string; url: string }>> {
  const supabase = await resolveDb(db);

  const convRes = await getConversationRowById(
    dealershipId,
    conversationId,
    supabase
  );
  if (!convRes.ok) {
    return convRes;
  }
  if (convRes.data.department !== "service") {
    return err(
      "FORBIDDEN",
      "Book Service link is only available for service conversations."
    );
  }

  const configRes = await loadServiceSchedulerConfigForDealership(
    dealershipId,
    supabase
  );
  if (!configRes.ok) {
    return configRes;
  }
  const config = configRes.data;
  if (!config) {
    return err(
      "NOT_CONFIGURED",
      "Service scheduling URL is not configured. Add it in Settings → Service scheduling."
    );
  }

  const eventRes = await recordServiceSchedulerLinkSent(supabase, {
    conversationId,
    staffUserId,
    url: config.url,
  });
  if (!eventRes.ok) {
    return eventRes;
  }

  return ok({ messageText: config.messageText, url: config.url });
}

export async function maybeRecordServiceSchedulerLinkOnStaffSend(
  input: {
    dealershipId: string;
    conversationId: string;
    staffUserId: string;
    body: string;
  },
  db?: TypedSupabaseClient
): Promise<Result<void>> {
  if (!/\bhttps?:\/\//i.test(input.body)) {
    return ok(undefined);
  }

  const supabase = await resolveDb(db);
  const configRes = await loadServiceSchedulerConfigForDealership(
    input.dealershipId,
    supabase
  );
  if (!configRes.ok) {
    return configRes;
  }
  const config = configRes.data;
  if (!config || !messageBodyIncludesSchedulerUrl(input.body, config.url)) {
    return ok(undefined);
  }

  return recordServiceSchedulerLinkSent(supabase, {
    conversationId: input.conversationId,
    staffUserId: input.staffUserId,
    url: config.url,
  });
}
