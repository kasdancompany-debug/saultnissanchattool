import "server-only";

import { readPipelineFromMetadata } from "@/lib/conversation/pipeline-outcomes";
import { captureServerException } from "@/lib/observability/server-capture";
import { getConversationRowById } from "@/server/data/conversations";
import { setConversationPipelineOutcome } from "@/server/data/conversation-pipeline";
import type { TypedSupabaseClient } from "@/server/db/server-client";

/**
 * Best-effort: stamp `metadata.pipeline.appointment` when staff confirms an appointment.
 * Never throws; does not block the appointment write if pipeline metadata is missing or RPC fails.
 */
export async function trySyncConversationPipelineAppointment(
  input: {
    dealershipId: string;
    conversationId: string;
    actorUserId: string | null | undefined;
    note?: string | null;
  },
  db?: TypedSupabaseClient
): Promise<void> {
  const actor = input.actorUserId?.trim();
  if (!actor) {
    return;
  }

  try {
    const conv = await getConversationRowById(
      input.dealershipId,
      input.conversationId,
      db
    );
    if (!conv.ok) {
      return;
    }

    const metadata = conv.data.metadata;
    if (metadata == null) {
      return;
    }

    const pipeline = readPipelineFromMetadata(metadata);
    if (pipeline.appointment?.at) {
      return;
    }

    const stamped = await setConversationPipelineOutcome(
      {
        dealershipId: input.dealershipId,
        conversationId: input.conversationId,
        actorUserId: actor,
        outcome: "appointment",
        note: input.note?.trim() || "Appointment confirmed",
      },
      db
    );

    if (!stamped.ok) {
      captureServerException(new Error(stamped.error.message), {
        where: "trySyncConversationPipelineAppointment",
        code: stamped.error.code,
        dealershipId: input.dealershipId,
        conversationId: input.conversationId,
      });
    }
  } catch (error) {
    captureServerException(error, {
      where: "trySyncConversationPipelineAppointment",
      dealershipId: input.dealershipId,
      conversationId: input.conversationId,
    });
  }
}
