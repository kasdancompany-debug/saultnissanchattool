import type { StaffDepartment } from "@/integrations/supabase/database.types";
import type { PipelineOutcomeStamp } from "@/lib/conversation/pipeline-outcomes";
import {
  detectAppointmentIntent,
  type AppointmentIntentInsight,
} from "@/lib/opportunity/detect-appointment-intent";
import type { AppointmentRow } from "@/lib/appointments/types";
import { pickPrimaryAppointment } from "@/lib/appointments/types";

export type { AppointmentIntentInsight };

export type AppointmentReadinessKind =
  | "booked"
  | "proposed"
  | "interested"
  | "none";

export type AppointmentReadiness = {
  kind: AppointmentReadinessKind;
  headline: string;
  detail: string;
  /** Staff should use confirm flow when intent is detected (never auto-book). */
  promptMarkInPipeline: boolean;
  /** Structured intent for Insights — suggest only until staff confirms. */
  intent: AppointmentIntentInsight | null;
};

/** Customer named a day/time or asked to come in then. */
const PROPOSED_VISIT_RE =
  /\b(?:can i (?:come|do|book|stop by)|could i (?:come|book)|how about (?:tomorrow|today|tonight)|(?:tomorrow|today|tonight)(?:\s+works)?|(?:book|schedule|come in|stop by).{0,40}(?:tomorrow|today|monday|tuesday|wednesday|thursday|friday|saturday|sunday)|(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)(?:\s+works)?|this (?:afternoon|evening|morning)|next week)\b/i;

const VISIT_INTEREST_RE =
  /\b(?:appointment|book(?:ing)?|schedule|test drive|come in|visit|stop by|see you)\b/i;

const DAY_HINT_RE =
  /\b(tomorrow|today|tonight|monday|tuesday|wednesday|thursday|friday|saturday|sunday|this week|next week)\b/i;

function formatStampDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

function proposedTimeHint(customerText: string): string | null {
  const lines = customerText.split(/\n/).map((l) => l.trim()).filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const line = lines[i];
    const day = line.match(DAY_HINT_RE);
    if (day) {
      return formatDayLabel(day[1]);
    }
    if (PROPOSED_VISIT_RE.test(line)) {
      return "Specific day mentioned";
    }
  }
  return null;
}

function formatDayLabel(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

export function customerProposedVisit(customerText: string): boolean {
  const t = customerText.trim();
  if (!t) return false;
  if (PROPOSED_VISIT_RE.test(t)) return true;
  if (DAY_HINT_RE.test(t) && VISIT_INTEREST_RE.test(t)) return true;
  const recent = t.split(/\n/).slice(-4).join("\n");
  return (
    DAY_HINT_RE.test(recent) &&
    /\b(can i|could i|how about|works for me)\b/i.test(recent)
  );
}

function readinessFromAppointmentRow(
  row: Pick<
    AppointmentRow,
    "status" | "confirmed_datetime" | "proposed_datetime" | "department"
  >
): AppointmentReadiness | null {
  if (row.status === "confirmed" || row.status === "completed") {
    const when = row.confirmed_datetime
      ? formatStampDate(row.confirmed_datetime)
      : "time not recorded";
    return {
      kind: "booked",
      headline: "Appointment confirmed",
      detail: `${row.department === "service" ? "Service" : "Sales"} · ${when}`,
      promptMarkInPipeline: false,
      intent: null,
    };
  }
  if (row.status === "cancelled") {
    return {
      kind: "none",
      headline: "Appointment cancelled",
      detail: "This visit was cancelled. Add a new appointment if they reschedule.",
      promptMarkInPipeline: false,
      intent: null,
    };
  }
  if (row.status === "no_show") {
    const when = row.confirmed_datetime
      ? formatStampDate(row.confirmed_datetime)
      : null;
    return {
      kind: "booked",
      headline: "No-show recorded",
      detail: when ? `Confirmed slot · ${when}` : "Marked as no-show.",
      promptMarkInPipeline: false,
      intent: null,
    };
  }
  if (row.status === "proposed" || row.status === "awaiting_confirmation") {
    const when = row.proposed_datetime
      ? formatStampDate(row.proposed_datetime)
      : null;
    return {
      kind: "proposed",
      headline: when ? `Proposed visit — ${when}` : "Proposed visit",
      detail:
        row.status === "awaiting_confirmation"
          ? "Awaiting staff confirmation — use Confirm appointment when ready."
          : "Staff must confirm before this counts as booked.",
      promptMarkInPipeline: true,
      intent: null,
    };
  }
  return null;
}

function readinessFromIntent(
  intent: AppointmentIntentInsight,
  customerText: string
): AppointmentReadiness {
  const hint = proposedTimeHint(customerText) ?? intent.proposedTimeLabel;
  const kind =
    intent.confidence >= 50 || customerProposedVisit(customerText)
      ? "proposed"
      : "interested";

  return {
    kind,
    headline: hint ? `Appointment intent — ${hint}` : "Appointment intent detected",
    detail:
      "Suggestion only — confirm with the customer, then use Confirm appointment. Nothing is booked automatically.",
    promptMarkInPipeline: true,
    intent,
  };
}

export function resolveAppointmentReadiness(input: {
  customerText: string;
  conversationDepartment: StaffDepartment;
  pipelineAppointment: PipelineOutcomeStamp | null | undefined;
  conversationAppointments?: AppointmentRow[];
}): AppointmentReadiness {
  if (input.pipelineAppointment?.at) {
    return {
      kind: "booked",
      headline: "Appointment booked",
      detail: `Marked in pipeline · ${formatStampDate(input.pipelineAppointment.at)}`,
      promptMarkInPipeline: false,
      intent: null,
    };
  }

  const primary = pickPrimaryAppointment(input.conversationAppointments ?? []);
  if (primary) {
    const fromRow = readinessFromAppointmentRow(primary);
    if (fromRow) {
      if (
        fromRow.kind === "booked" ||
        primary.status === "cancelled" ||
        primary.status === "no_show"
      ) {
        return fromRow;
      }
      const intent = detectAppointmentIntent({
        customerText: input.customerText,
        conversationDepartment: input.conversationDepartment,
      });
      return {
        ...fromRow,
        intent: intent.show ? intent : null,
      };
    }
  }

  const intent = detectAppointmentIntent({
    customerText: input.customerText,
    conversationDepartment: input.conversationDepartment,
  });

  if (intent.show) {
    return readinessFromIntent(intent, input.customerText);
  }

  const proposed = customerProposedVisit(input.customerText);
  if (proposed) {
    const hint = proposedTimeHint(input.customerText);
    return {
      kind: "proposed",
      headline: hint ? `Wants visit — ${hint}` : "Wants visit — confirm time",
      detail:
        "Customer proposed a day or time in chat. Staff must confirm — nothing is booked automatically.",
      promptMarkInPipeline: true,
      intent: null,
    };
  }

  if (VISIT_INTEREST_RE.test(input.customerText)) {
    return {
      kind: "interested",
      headline: "Discussing a visit",
      detail:
        "Ask for a specific day and time, then use Confirm appointment when ready.",
      promptMarkInPipeline: true,
      intent: null,
    };
  }

  return {
    kind: "none",
    headline: "No visit proposed yet",
    detail: "When they name a day or time, appointment intent will appear here.",
    promptMarkInPipeline: false,
    intent: null,
  };
}
