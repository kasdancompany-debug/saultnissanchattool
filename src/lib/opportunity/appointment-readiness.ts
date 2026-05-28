import type { PipelineOutcomeStamp } from "@/lib/conversation/pipeline-outcomes";

export type AppointmentReadinessKind =
  | "booked"
  | "proposed"
  | "interested"
  | "none";

export type AppointmentReadiness = {
  kind: AppointmentReadinessKind;
  headline: string;
  detail: string;
  /** Staff should use Pipeline → Appointment when calendar is set. */
  promptMarkInPipeline: boolean;
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
      const word = day[1].toLowerCase();
      return word.charAt(0).toUpperCase() + word.slice(1);
    }
    if (PROPOSED_VISIT_RE.test(line)) {
      return "Specific day mentioned";
    }
  }
  return null;
}

export function customerProposedVisit(customerText: string): boolean {
  const t = customerText.trim();
  if (!t) return false;
  if (PROPOSED_VISIT_RE.test(t)) return true;
  if (DAY_HINT_RE.test(t) && VISIT_INTEREST_RE.test(t)) return true;
  const recent = t.split(/\n/).slice(-4).join("\n");
  return DAY_HINT_RE.test(recent) && /\b(can i|could i|how about|works for me)\b/i.test(recent);
}

export function resolveAppointmentReadiness(input: {
  customerText: string;
  pipelineAppointment: PipelineOutcomeStamp | null | undefined;
}): AppointmentReadiness {
  if (input.pipelineAppointment?.at) {
    return {
      kind: "booked",
      headline: "Appointment booked",
      detail: `Marked in pipeline · ${formatStampDate(input.pipelineAppointment.at)}`,
      promptMarkInPipeline: false,
    };
  }

  const proposed = customerProposedVisit(input.customerText);
  if (proposed) {
    const hint = proposedTimeHint(input.customerText);
    return {
      kind: "proposed",
      headline: hint ? `Wants visit — ${hint}` : "Wants visit — confirm time",
      detail:
        "Customer proposed a day or time in chat. Confirm in your calendar, then mark Appointment in Pipeline.",
      promptMarkInPipeline: true,
    };
  }

  if (VISIT_INTEREST_RE.test(input.customerText)) {
    return {
      kind: "interested",
      headline: "Discussing a visit",
      detail: "Ask for a specific day and time, then mark Appointment in Pipeline when booked.",
      promptMarkInPipeline: true,
    };
  }

  return {
    kind: "none",
    headline: "No visit proposed yet",
    detail: "When they name a day or time, it will show here for you to confirm.",
    promptMarkInPipeline: false,
  };
}
