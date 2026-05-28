import "server-only";

import type {
  AppointmentDepartment,
  AppointmentSource,
  AppointmentStatus,
  StaffDepartment,
} from "@/integrations/supabase/database.types";
import { buildAppointmentConfirmedSystemNote } from "@/lib/appointments/confirmed-system-note";
import { shouldSyncPipelineOnAppointmentStatus } from "@/lib/appointments/pipeline-bridge";
import type { AppointmentRow } from "@/lib/appointments/types";
import { computeAppointmentMetrics } from "@/server/appointments/appointment-metrics";
import { trySyncConversationPipelineAppointment } from "@/server/appointments/sync-conversation-pipeline";
import type {
  AppointmentMetrics,
  AppointmentMetricsPeriod,
  CreateAppointmentFromConversationInput,
  GetUpcomingAppointmentsOptions,
} from "@/server/appointments/types";
import {
  repositoryCountUpcomingAppointments,
  repositoryGetAppointmentById,
  repositoryInsertAppointment,
  repositoryListAppointmentsForConversation,
  repositoryListAppointmentsForMetrics,
  repositoryListUpcomingAppointments,
  repositoryNormalizeOptionalText,
  repositoryRequiresConfirmedDatetime,
  repositoryUpdateAppointment,
  type AppointmentUpdate,
} from "@/server/data/appointments-repository";
import { getConversationRowById } from "@/server/data/conversations";
import { insertConversationEvent } from "@/server/data/conversation-events";
import { createMessage } from "@/server/data/messages";
import { resolveDb } from "@/server/data/internal";
import { getStaffUserById } from "@/server/data/staff-users";
import type { TypedSupabaseClient } from "@/server/db/server-client";
import { err, ok, type Result } from "@/server/result";

const DEFAULT_UPCOMING_LIMIT = 50;

function departmentFromConversation(
  conversationDepartment: StaffDepartment
): AppointmentDepartment {
  return conversationDepartment === "service" ? "service" : "sales";
}

async function recordAppointmentEvent(
  db: TypedSupabaseClient,
  input: {
    conversationId: string;
    actorUserId: string | null;
    kind: string;
    appointmentId: string;
    status: AppointmentStatus;
    extra?: Record<string, unknown>;
  }
): Promise<void> {
  await insertConversationEvent(db, {
    conversation_id: input.conversationId,
    event_type: "metadata_changed",
    actor_user_id: input.actorUserId,
    payload: {
      kind: input.kind,
      appointment_id: input.appointmentId,
      status: input.status,
      ...input.extra,
    },
  });
}

async function maybeSyncPipeline(
  input: {
    dealershipId: string;
    conversationId: string;
    actorUserId: string;
    status: AppointmentStatus;
    syncPipeline: boolean;
    note?: string | null;
  },
  db: TypedSupabaseClient
): Promise<void> {
  if (!input.syncPipeline || !shouldSyncPipelineOnAppointmentStatus(input.status)) {
    return;
  }
  await trySyncConversationPipelineAppointment(
    {
      dealershipId: input.dealershipId,
      conversationId: input.conversationId,
      actorUserId: input.actorUserId,
      note: input.note,
    },
    db
  );
}

type ApplyUpdateInput = {
  dealershipId: string;
  appointmentId: string;
  actorUserId: string;
  patch: AppointmentUpdate;
  syncPipeline?: boolean;
  eventKind?: string;
};

async function applyAppointmentUpdate(
  input: ApplyUpdateInput,
  db?: TypedSupabaseClient
): Promise<Result<AppointmentRow>> {
  const existing = await repositoryGetAppointmentById(
    input.dealershipId,
    input.appointmentId,
    db
  );
  if (!existing.ok) {
    return existing;
  }

  if (Object.keys(input.patch).length === 0) {
    return ok(existing.data);
  }

  const nextStatus = (input.patch.status ?? existing.data.status) as AppointmentStatus;
  if (
    repositoryRequiresConfirmedDatetime(nextStatus) &&
    input.patch.confirmed_datetime === undefined &&
    !existing.data.confirmed_datetime
  ) {
    return err(
      "VALIDATION",
      "confirmed_datetime is required for confirmed or completed appointments"
    );
  }

  const updated = await repositoryUpdateAppointment(
    input.dealershipId,
    input.appointmentId,
    input.patch,
    db
  );
  if (!updated.ok) {
    return updated;
  }

  const row = updated.data;
  const supabase = await resolveDb(db);

  await recordAppointmentEvent(supabase, {
    conversationId: row.conversation_id,
    actorUserId: input.actorUserId,
    kind: input.eventKind ?? "appointment_updated",
    appointmentId: row.id,
    status: row.status,
    extra: {
      patch: Object.keys(input.patch),
      department: row.department,
      proposed_datetime: row.proposed_datetime,
      confirmed_datetime: row.confirmed_datetime,
      vehicle_interest: row.vehicle_interest,
    },
  });

  await maybeSyncPipeline(
    {
      dealershipId: input.dealershipId,
      conversationId: row.conversation_id,
      actorUserId: input.actorUserId,
      status: row.status,
      syncPipeline: input.syncPipeline !== false,
      note: row.notes,
    },
    supabase
  );

  return ok(row);
}

export async function createAppointmentFromConversation(
  input: CreateAppointmentFromConversationInput,
  db?: TypedSupabaseClient
): Promise<Result<AppointmentRow>> {
  if (!input.dealershipId?.trim() || !input.conversationId?.trim()) {
    return err("VALIDATION", "dealershipId and conversationId are required");
  }
  if (!input.actorUserId?.trim()) {
    return err("VALIDATION", "actorUserId is required");
  }

  const supabase = await resolveDb(db);

  const conv = await getConversationRowById(
    input.dealershipId,
    input.conversationId,
    supabase
  );
  if (!conv.ok) {
    return conv;
  }

  const department =
    input.department ?? departmentFromConversation(conv.data.department);
  const status = input.status ?? "proposed";
  const source = input.source ?? "manual";

  if (
    repositoryRequiresConfirmedDatetime(status) &&
    !input.confirmedDatetime?.trim()
  ) {
    return err(
      "VALIDATION",
      "confirmedDatetime is required when creating a confirmed or completed appointment"
    );
  }

  const inserted = await repositoryInsertAppointment(
    {
      dealership_id: input.dealershipId,
      conversation_id: input.conversationId,
      customer_id: conv.data.customer_id,
      department,
      status,
      proposed_datetime: input.proposedDatetime ?? null,
      confirmed_datetime: input.confirmedDatetime ?? null,
      assigned_user_id: input.assignedUserId ?? null,
      booked_by_user_id: input.actorUserId,
      vehicle_interest: repositoryNormalizeOptionalText(input.vehicleInterest),
      notes: repositoryNormalizeOptionalText(input.notes),
      source,
    },
    supabase
  );
  if (!inserted.ok) {
    return inserted;
  }

  const row = inserted.data;

  const createEventKind =
    row.status === "proposed" || row.status === "awaiting_confirmation"
      ? "appointment_proposed"
      : "appointment_created";

  await recordAppointmentEvent(supabase, {
    conversationId: input.conversationId,
    actorUserId: input.actorUserId,
    kind: createEventKind,
    appointmentId: row.id,
    status: row.status,
    extra: {
      department: row.department,
      source: row.source,
      proposed_datetime: row.proposed_datetime,
      vehicle_interest: row.vehicle_interest,
    },
  });

  if (input.source === "ai_detected") {
    const { ensureAppointmentIntentEvent } = await import(
      "@/server/appointments/record-appointment-intent"
    );
    await ensureAppointmentIntentEvent(
      {
        dealershipId: input.dealershipId,
        conversationId: input.conversationId,
        actorUserId: input.actorUserId,
        department: row.department,
      },
      supabase
    );
  }

  await maybeSyncPipeline(
    {
      dealershipId: input.dealershipId,
      conversationId: input.conversationId,
      actorUserId: input.actorUserId,
      status: row.status,
      syncPipeline: input.syncPipeline !== false,
      note: input.notes,
    },
    supabase
  );

  return ok(row);
}

export async function updateAppointmentDetails(
  input: {
    dealershipId: string;
    appointmentId: string;
    actorUserId: string;
    patch: {
      department?: AppointmentDepartment;
      proposedDatetime?: string | null;
      confirmedDatetime?: string | null;
      assignedUserId?: string | null;
      vehicleInterest?: string | null;
      notes?: string | null;
    };
  },
  db?: TypedSupabaseClient
): Promise<Result<AppointmentRow>> {
  const patch: AppointmentUpdate = {};
  const p = input.patch;
  if (p.department !== undefined) patch.department = p.department;
  if (p.proposedDatetime !== undefined) patch.proposed_datetime = p.proposedDatetime;
  if (p.confirmedDatetime !== undefined) patch.confirmed_datetime = p.confirmedDatetime;
  if (p.assignedUserId !== undefined) patch.assigned_user_id = p.assignedUserId;
  if (p.vehicleInterest !== undefined) {
    patch.vehicle_interest = repositoryNormalizeOptionalText(p.vehicleInterest);
  }
  if (p.notes !== undefined) patch.notes = repositoryNormalizeOptionalText(p.notes);

  return applyAppointmentUpdate(
    {
      dealershipId: input.dealershipId,
      appointmentId: input.appointmentId,
      actorUserId: input.actorUserId,
      patch,
      syncPipeline: false,
      eventKind: "appointment_edited",
    },
    db
  );
}

export async function updateAppointmentStatus(
  input: {
    dealershipId: string;
    appointmentId: string;
    actorUserId: string;
    status: AppointmentStatus;
    proposedDatetime?: string | null;
    confirmedDatetime?: string | null;
    syncPipeline?: boolean;
  },
  db?: TypedSupabaseClient
): Promise<Result<AppointmentRow>> {
  const patch: AppointmentUpdate = { status: input.status };
  if (input.proposedDatetime !== undefined) {
    patch.proposed_datetime = input.proposedDatetime;
  }
  if (input.confirmedDatetime !== undefined) {
    patch.confirmed_datetime = input.confirmedDatetime;
  }

  return applyAppointmentUpdate(
    {
      dealershipId: input.dealershipId,
      appointmentId: input.appointmentId,
      actorUserId: input.actorUserId,
      patch,
      syncPipeline: input.syncPipeline,
      eventKind: "appointment_status_changed",
    },
    db
  );
}

export async function confirmAppointment(
  input: {
    dealershipId: string;
    appointmentId: string;
    actorUserId: string;
    confirmedDatetime: string;
    syncPipeline?: boolean;
  },
  db?: TypedSupabaseClient
): Promise<Result<AppointmentRow>> {
  return applyAppointmentUpdate(
    {
      dealershipId: input.dealershipId,
      appointmentId: input.appointmentId,
      actorUserId: input.actorUserId,
      patch: {
        status: "confirmed",
        confirmed_datetime: input.confirmedDatetime,
        booked_by_user_id: input.actorUserId,
      },
      syncPipeline: input.syncPipeline,
      eventKind: "appointment_confirmed",
    },
    db
  );
}

export async function cancelAppointment(
  input: {
    dealershipId: string;
    appointmentId: string;
    actorUserId: string;
    notes?: string | null;
  },
  db?: TypedSupabaseClient
): Promise<Result<AppointmentRow>> {
  const patch: AppointmentUpdate = { status: "cancelled" };
  const notes = repositoryNormalizeOptionalText(input.notes);
  if (notes) {
    patch.notes = notes;
  }

  return applyAppointmentUpdate(
    {
      dealershipId: input.dealershipId,
      appointmentId: input.appointmentId,
      actorUserId: input.actorUserId,
      patch,
      syncPipeline: false,
      eventKind: "appointment_cancelled",
    },
    db
  );
}

export async function markAppointmentCompleted(
  input: {
    dealershipId: string;
    appointmentId: string;
    actorUserId: string;
    /** Defaults to existing `confirmed_datetime` or now. */
    confirmedDatetime?: string;
    syncPipeline?: boolean;
  },
  db?: TypedSupabaseClient
): Promise<Result<AppointmentRow>> {
  const existing = await repositoryGetAppointmentById(
    input.dealershipId,
    input.appointmentId,
    db
  );
  if (!existing.ok) {
    return existing;
  }

  const confirmedDatetime =
    input.confirmedDatetime?.trim() ||
    existing.data.confirmed_datetime ||
    new Date().toISOString();

  return applyAppointmentUpdate(
    {
      dealershipId: input.dealershipId,
      appointmentId: input.appointmentId,
      actorUserId: input.actorUserId,
      patch: {
        status: "completed",
        confirmed_datetime: confirmedDatetime,
      },
      syncPipeline: input.syncPipeline,
      eventKind: "appointment_completed",
    },
    db
  );
}

export async function markNoShow(
  input: {
    dealershipId: string;
    appointmentId: string;
    actorUserId: string;
    notes?: string | null;
  },
  db?: TypedSupabaseClient
): Promise<Result<AppointmentRow>> {
  const existing = await repositoryGetAppointmentById(
    input.dealershipId,
    input.appointmentId,
    db
  );
  if (!existing.ok) {
    return existing;
  }

  const patch: AppointmentUpdate = { status: "no_show" };
  if (!existing.data.confirmed_datetime) {
    patch.confirmed_datetime = new Date().toISOString();
  }
  const notes = repositoryNormalizeOptionalText(input.notes);
  if (notes) {
    patch.notes = notes;
  }

  return applyAppointmentUpdate(
    {
      dealershipId: input.dealershipId,
      appointmentId: input.appointmentId,
      actorUserId: input.actorUserId,
      patch,
      syncPipeline: false,
      eventKind: "appointment_no_show",
    },
    db
  );
}

export async function getAppointmentsForConversation(
  dealershipId: string,
  conversationId: string,
  db?: TypedSupabaseClient
): Promise<Result<AppointmentRow[]>> {
  return repositoryListAppointmentsForConversation(
    dealershipId,
    conversationId,
    db
  );
}

export async function getUpcomingAppointments(
  dealershipId: string,
  options: GetUpcomingAppointmentsOptions = {},
  db?: TypedSupabaseClient
): Promise<Result<AppointmentRow[]>> {
  const nowIso = options.now ?? new Date().toISOString();
  const limit = Math.min(Math.max(options.limit ?? DEFAULT_UPCOMING_LIMIT, 1), 200);

  return repositoryListUpcomingAppointments(
    dealershipId,
    {
      nowIso,
      limit,
      department: options.department,
    },
    db
  );
}

export async function getAppointmentMetrics(
  dealershipId: string,
  period: AppointmentMetricsPeriod,
  db?: TypedSupabaseClient
): Promise<Result<AppointmentMetrics>> {
  if (!period.from?.trim() || !period.to?.trim()) {
    return err("VALIDATION", "period.from and period.to are required");
  }
  if (new Date(period.from).getTime() > new Date(period.to).getTime()) {
    return err("VALIDATION", "period.from must be before period.to");
  }

  const nowIso = new Date().toISOString();
  const [rowsRes, upcomingRes] = await Promise.all([
    repositoryListAppointmentsForMetrics(dealershipId, period, db),
    repositoryCountUpcomingAppointments(dealershipId, nowIso, db),
  ]);

  if (!rowsRes.ok) {
    return rowsRes;
  }
  if (!upcomingRes.ok) {
    return upcomingRes;
  }

  return ok(
    computeAppointmentMetrics({
      period,
      rows: rowsRes.data,
      upcoming: upcomingRes.data,
      nowIso,
    })
  );
}

export type SaveConfirmedAppointmentInput = {
  dealershipId: string;
  conversationId: string;
  actorUserId: string;
  /** When set, updates that row; otherwise creates a new confirmed appointment. */
  appointmentId?: string | null;
  department: AppointmentDepartment;
  confirmedDatetime: string;
  assignedUserId?: string | null;
  vehicleInterest?: string | null;
  notes?: string | null;
  source?: AppointmentSource;
};

/**
 * Human-confirmed save from the inbox modal: upsert appointment, pipeline stamp, system timeline note.
 */
export async function saveConfirmedAppointmentFromConversation(
  input: SaveConfirmedAppointmentInput,
  db?: TypedSupabaseClient
): Promise<Result<AppointmentRow>> {
  if (!input.confirmedDatetime?.trim()) {
    return err("VALIDATION", "Confirmed date and time are required");
  }

  const supabase = await resolveDb(db);
  const actor = await getStaffUserById(
    input.dealershipId,
    input.actorUserId,
    supabase
  );
  if (!actor.ok) {
    return actor;
  }
  const confirmedByDisplayName =
    actor.data.display_name?.trim() || actor.data.email || "Staff";

  let assigneeDisplayName: string | null = null;
  const assignedId = input.assignedUserId?.trim() || null;
  if (assignedId) {
    const assignee = await getStaffUserById(
      input.dealershipId,
      assignedId,
      supabase
    );
    if (!assignee.ok) {
      return assignee;
    }
    assigneeDisplayName =
      assignee.data.display_name?.trim() || assignee.data.email;
  }

  const patch: AppointmentUpdate = {
    department: input.department,
    status: "confirmed",
    confirmed_datetime: input.confirmedDatetime,
    assigned_user_id: assignedId,
    booked_by_user_id: input.actorUserId,
    vehicle_interest: repositoryNormalizeOptionalText(input.vehicleInterest),
    notes: repositoryNormalizeOptionalText(input.notes),
  };

  let row: AppointmentRow;
  const appointmentId = input.appointmentId?.trim();

  if (appointmentId) {
    const updated = await applyAppointmentUpdate(
      {
        dealershipId: input.dealershipId,
        appointmentId,
        actorUserId: input.actorUserId,
        patch,
        syncPipeline: false,
        eventKind: "appointment_confirmed",
      },
      supabase
    );
    if (!updated.ok) {
      return updated;
    }
    row = updated.data;
  } else {
    const conv = await getConversationRowById(
      input.dealershipId,
      input.conversationId,
      supabase
    );
    if (!conv.ok) {
      return conv;
    }

    const inserted = await repositoryInsertAppointment(
      {
        dealership_id: input.dealershipId,
        conversation_id: input.conversationId,
        customer_id: conv.data.customer_id,
        department: input.department,
        status: "confirmed",
        proposed_datetime: input.confirmedDatetime,
        confirmed_datetime: input.confirmedDatetime,
        assigned_user_id: assignedId,
        booked_by_user_id: input.actorUserId,
        vehicle_interest: patch.vehicle_interest ?? null,
        notes: patch.notes ?? null,
        source: input.source ?? "manual",
      },
      supabase
    );
    if (!inserted.ok) {
      return inserted;
    }
    row = inserted.data;

    await recordAppointmentEvent(supabase, {
      conversationId: input.conversationId,
      actorUserId: input.actorUserId,
      kind: "appointment_confirmed",
      appointmentId: row.id,
      status: row.status,
      extra: {
        department: row.department,
        source: row.source,
        via: "confirm_modal",
        confirmed_at: input.confirmedDatetime,
        confirmed_datetime: input.confirmedDatetime,
      },
    });
  }

  await maybeSyncPipeline(
    {
      dealershipId: input.dealershipId,
      conversationId: row.conversation_id,
      actorUserId: input.actorUserId,
      status: "confirmed",
      syncPipeline: true,
      note: patch.notes,
    },
    supabase
  );

  const systemBody = buildAppointmentConfirmedSystemNote({
    department: input.department,
    confirmedDatetimeIso: input.confirmedDatetime,
    assigneeDisplayName,
    vehicleInterest: input.vehicleInterest,
    confirmedByDisplayName,
    notes: input.notes,
  });

  const systemMsg = await createMessage(
    {
      dealershipId: input.dealershipId,
      conversationId: row.conversation_id,
      senderType: "system",
      body: systemBody,
      deliveryStatus: "delivered",
      metadata: {
        kind: "appointment_confirmed",
        appointment_id: row.id,
        confirmed_at: input.confirmedDatetime,
        department: input.department,
      },
    },
    supabase
  );

  if (!systemMsg.ok) {
    return systemMsg;
  }

  return ok(row);
}
