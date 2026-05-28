import { formatAppointmentDisplay } from "@/lib/appointments/format-datetime";
import {
  APPOINTMENT_DEPARTMENT_LABEL,
  APPOINTMENT_STATUS_LABEL,
  type AppointmentStatus,
} from "@/lib/appointments/types";
import type { ConversationEventType } from "@/integrations/supabase/database.types";
import type { InboxMessageView } from "@/lib/inbox/inbox-message-view";
import type {
  InboxThreadTimelineItem,
  InboxTimelineActivity,
  TimelineActivityTone,
  TimelineSourceEvent,
} from "@/lib/inbox/inbox-timeline-types";

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function payloadRecord(payload: unknown): Record<string, unknown> | null {
  return isRecord(payload) ? payload : null;
}

function readString(payload: Record<string, unknown>, key: string): string | null {
  const v = payload[key];
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function formatWhen(iso: string | null | undefined): string | null {
  if (!iso?.trim()) {
    return null;
  }
  return formatAppointmentDisplay(iso);
}

function departmentLabel(raw: string | null): string | null {
  if (raw === "sales" || raw === "service") {
    return APPOINTMENT_DEPARTMENT_LABEL[raw];
  }
  return raw;
}

function statusLabel(raw: string | null): string | null {
  if (!raw) {
    return null;
  }
  const statuses: Record<string, string> = APPOINTMENT_STATUS_LABEL;
  return statuses[raw as AppointmentStatus] ?? raw;
}

function activityBase(
  event: TimelineSourceEvent,
  input: {
    kind: string;
    title: string;
    detail: string | null;
    tone: TimelineActivityTone;
    actorLabel: string | null;
  }
): InboxTimelineActivity {
  return {
    id: event.id,
    created_at: event.created_at,
    kind: input.kind,
    title: input.title,
    detail: input.detail,
    tone: input.tone,
    actorLabel: input.actorLabel,
  };
}

function detailParts(parts: (string | null | undefined)[]): string | null {
  const lines = parts.filter((p): p is string => Boolean(p?.trim()));
  return lines.length > 0 ? lines.join(" · ") : null;
}

export function isRedundantAppointmentSystemMessage(
  message: InboxMessageView
): boolean {
  if (message.sender_type !== "system") {
    return false;
  }
  const meta = payloadRecord(message.metadata);
  const kind = meta ? readString(meta, "kind") : null;
  return kind === "appointment_confirmed";
}

function activityFromMetadataChanged(
  event: TimelineSourceEvent,
  payload: Record<string, unknown>,
  actorLabel: string | null
): InboxTimelineActivity | null {
  const kind = readString(payload, "kind");
  if (!kind) {
    return null;
  }

  const department = departmentLabel(readString(payload, "department"));
  const status = readString(payload, "status");
  const proposedAt = formatWhen(readString(payload, "proposed_datetime"));
  const confirmedAt = formatWhen(
    readString(payload, "confirmed_at") ?? readString(payload, "confirmed_datetime")
  );
  const vehicle = readString(payload, "vehicle_interest");
  const confidence = payload.confidence;
  const confidenceLabel =
    typeof confidence === "number" ? `${Math.round(confidence)}% confidence` : null;

  switch (kind) {
    case "appointment_intent_detected":
      return activityBase(event, {
        kind,
        title: "Appointment intent detected",
        detail: detailParts([
          department ? `${department} queue` : null,
          confidenceLabel,
          readString(payload, "proposed_time_label"),
        ]),
        tone: "intent",
        actorLabel,
      });
    case "appointment_proposed":
      return activityBase(event, {
        kind,
        title: "Appointment proposed",
        detail: detailParts([
          department,
          proposedAt ? `Proposed ${proposedAt}` : null,
          vehicle,
        ]),
        tone: "proposed",
        actorLabel,
      });
    case "appointment_created": {
      const isProposed =
        status === "proposed" || status === "awaiting_confirmation";
      return activityBase(event, {
        kind: isProposed ? "appointment_proposed" : kind,
        title: isProposed ? "Appointment proposed" : "Appointment created",
        detail: detailParts([
          department,
          proposedAt ? `Proposed ${proposedAt}` : null,
          statusLabel(status),
        ]),
        tone: isProposed ? "proposed" : "neutral",
        actorLabel,
      });
    }
    case "appointment_confirmed":
      return activityBase(event, {
        kind,
        title: "Appointment confirmed",
        detail: detailParts([
          department,
          confirmedAt ? `Confirmed ${confirmedAt}` : null,
          vehicle,
        ]),
        tone: "confirmed",
        actorLabel,
      });
    case "appointment_edited":
      return activityBase(event, {
        kind,
        title: "Appointment edited",
        detail: detailParts([
          department,
          proposedAt ? `Proposed ${proposedAt}` : null,
          confirmedAt ? `Confirmed ${confirmedAt}` : null,
        ]),
        tone: "edited",
        actorLabel,
      });
    case "appointment_completed":
      return activityBase(event, {
        kind,
        title: "Appointment completed",
        detail: detailParts([department, confirmedAt]),
        tone: "completed",
        actorLabel,
      });
    case "appointment_no_show":
      return activityBase(event, {
        kind,
        title: "No-show marked",
        detail: detailParts([department, statusLabel(status)]),
        tone: "no_show",
        actorLabel,
      });
    case "appointment_cancelled":
      return activityBase(event, {
        kind,
        title: "Appointment cancelled",
        detail: detailParts([department]),
        tone: "cancelled",
        actorLabel,
      });
    case "appointment_status_changed": {
      const mapped = mapStatusChangedActivity(event, payload, actorLabel, status);
      return mapped;
    }
    default:
      return null;
  }
}

function mapStatusChangedActivity(
  event: TimelineSourceEvent,
  payload: Record<string, unknown>,
  actorLabel: string | null,
  status: string | null
): InboxTimelineActivity | null {
  switch (status) {
    case "confirmed":
      return activityFromMetadataChanged(
        event,
        { ...payload, kind: "appointment_confirmed" },
        actorLabel
      );
    case "completed":
      return activityFromMetadataChanged(
        event,
        { ...payload, kind: "appointment_completed" },
        actorLabel
      );
    case "no_show":
      return activityFromMetadataChanged(
        event,
        { ...payload, kind: "appointment_no_show" },
        actorLabel
      );
    case "cancelled":
      return activityFromMetadataChanged(
        event,
        { ...payload, kind: "appointment_cancelled" },
        actorLabel
      );
    case "proposed":
    case "awaiting_confirmation":
      return activityFromMetadataChanged(
        event,
        { ...payload, kind: "appointment_proposed" },
        actorLabel
      );
    default:
      return null;
  }
}

function activityFromServiceSchedulerLink(
  event: TimelineSourceEvent,
  payload: Record<string, unknown>,
  actorLabel: string | null
): InboxTimelineActivity {
  const url = readString(payload, "url");
  return activityBase(event, {
    kind: "service_scheduler_link_sent",
    title: "Service scheduling link sent",
    detail: url,
    tone: "scheduler",
    actorLabel,
  });
}

export function timelineActivityFromConversationEvent(
  event: TimelineSourceEvent,
  staffNameById: Map<string, string>
): InboxTimelineActivity | null {
  const actorLabel = event.actor_user_id
    ? staffNameById.get(event.actor_user_id) ?? "Staff"
    : null;
  const payload = payloadRecord(event.payload);

  if (event.event_type === "service_scheduler_link_sent") {
    return activityFromServiceSchedulerLink(event, payload ?? {}, actorLabel);
  }

  if (event.event_type !== "metadata_changed" || !payload) {
    return null;
  }

  return activityFromMetadataChanged(event, payload, actorLabel);
}

const TIMELINE_EVENT_TYPES = new Set<ConversationEventType>([
  "metadata_changed",
  "service_scheduler_link_sent",
]);

export function isTimelineRelevantEvent(event: TimelineSourceEvent): boolean {
  if (!TIMELINE_EVENT_TYPES.has(event.event_type)) {
    return false;
  }
  if (event.event_type === "service_scheduler_link_sent") {
    return true;
  }
  const payload = payloadRecord(event.payload);
  const kind = payload ? readString(payload, "kind") : null;
  if (!kind) {
    return false;
  }
  return (
    kind.startsWith("appointment_") || kind === "appointment_intent_detected"
  );
}

function dedupeActivities(
  activities: InboxTimelineActivity[]
): InboxTimelineActivity[] {
  const out: InboxTimelineActivity[] = [];
  for (const activity of activities) {
    const prev = out[out.length - 1];
    if (
      prev &&
      prev.kind === activity.kind &&
      prev.title === activity.title &&
      Math.abs(
        new Date(prev.created_at).getTime() -
          new Date(activity.created_at).getTime()
      ) < 5000
    ) {
      continue;
    }
    out.push(activity);
  }
  return out;
}

export function mergeInboxThreadTimeline(input: {
  messages: InboxMessageView[];
  events: TimelineSourceEvent[];
  staffNameById: Map<string, string>;
}): InboxThreadTimelineItem[] {
  const filteredMessages = input.messages.filter(
    (m) => !isRedundantAppointmentSystemMessage(m)
  );

  const activities = dedupeActivities(
    input.events
      .filter(isTimelineRelevantEvent)
      .map((e) => timelineActivityFromConversationEvent(e, input.staffNameById))
      .filter((a): a is InboxTimelineActivity => a != null)
  );

  const items: InboxThreadTimelineItem[] = [
    ...filteredMessages.map((message) => ({
      type: "message" as const,
      sortKey: `msg:${message.created_at}:${message.id}`,
      message,
    })),
    ...activities.map((activity) => ({
      type: "activity" as const,
      sortKey: `evt:${activity.created_at}:${activity.id}`,
      activity,
    })),
  ];

  items.sort((a, b) => {
    const ta = a.type === "message" ? a.message.created_at : a.activity.created_at;
    const tb = b.type === "message" ? b.message.created_at : b.activity.created_at;
    if (ta !== tb) {
      return ta < tb ? -1 : 1;
    }
    return a.sortKey < b.sortKey ? -1 : a.sortKey > b.sortKey ? 1 : 0;
  });

  return items;
}
