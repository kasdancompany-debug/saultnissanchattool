import "server-only";

import type { Json } from "@/integrations/supabase/database.types";
import { createSupabaseAdminClient } from "@/integrations/supabase/admin";
import { resolveDb } from "@/server/data/internal";
import type { TypedSupabaseClient } from "@/server/db/server-client";
import type { InboundClassificationStored } from "@/server/ai/schemas/inbound-classification";
import { fromPostgrestError } from "@/server/data/postgrest-error";
import { ok, type Result } from "@/server/result";

export async function insertMessageAiRun(input: {
  dealershipId: string;
  conversationId: string;
  messageId: string;
  promptVersion: string;
  model: string;
  structuredOutput: InboundClassificationStored | Record<string, unknown>;
  latencyMs: number | null;
  error: string | null;
}): Promise<Result<string>> {
  const supabase = createSupabaseAdminClient();

  const res = await supabase
    .from("message_ai_runs")
    .insert({
      dealership_id: input.dealershipId,
      conversation_id: input.conversationId,
      message_id: input.messageId,
      prompt_version: input.promptVersion,
      model: input.model,
      structured_output: input.structuredOutput as Json,
      latency_ms: input.latencyMs,
      error: input.error,
    })
    .select("id")
    .single();

  if (res.error || !res.data) {
    return fromPostgrestError(res.error);
  }

  return ok(res.data.id);
}

export type LatestAiAssistForInbox = {
  id: string;
  message_id: string;
  prompt_version: string;
  model: string;
  structured_output: InboundClassificationStored | null;
  error: string | null;
  created_at: string;
};

export async function getLatestMessageAiRunForConversation(
  dealershipId: string,
  conversationId: string,
  db?: TypedSupabaseClient
): Promise<Result<LatestAiAssistForInbox | null>> {
  const supabase = await resolveDb(db);

  const res = await supabase
    .from("message_ai_runs")
    .select("id, message_id, prompt_version, model, structured_output, error, created_at")
    .eq("dealership_id", dealershipId)
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (res.error) {
    return fromPostgrestError(res.error);
  }

  if (!res.data) {
    return ok(null);
  }

  return ok({
    id: res.data.id,
    message_id: res.data.message_id,
    prompt_version: res.data.prompt_version,
    model: res.data.model,
    structured_output: res.data.structured_output as InboundClassificationStored | null,
    error: res.data.error,
    created_at: res.data.created_at,
  });
}
