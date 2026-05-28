import type { StaffDepartment } from "@/integrations/supabase/database.types";
import type { AppointmentDepartment } from "@/lib/appointments/types";
import { APPOINTMENT_DEPARTMENT_LABEL } from "@/lib/appointments/types";

export type AppointmentIntentConfidenceLabel = "High" | "Medium" | "Low";

export type AppointmentIntentInsight = {
  /** Show the Appointment intent insight (staff must confirm; never auto-books). */
  show: boolean;
  confidence: number;
  confidenceLabel: AppointmentIntentConfidenceLabel;
  department: AppointmentDepartment | null;
  proposedTimeLabel: string | null;
  /** Best-effort ISO for confirm modal prefill (local date/time heuristic). */
  proposedDatetimeIso: string | null;
  matchedSignals: string[];
  summary: string;
};

type IntentSignal = {
  id: string;
  label: string;
  weight: number;
  re: RegExp;
};

const INTENT_SIGNALS: IntentSignal[] = [
  {
    id: "come_tomorrow",
    label: "Asked to come in (day mentioned)",
    weight: 28,
    re: /\bcan i (?:come in|do|stop by)\b.{0,30}\b(?:tomorrow|today|tonight)\b/i,
  },
  {
    id: "come_tomorrow_short",
    label: "Asked to visit on a day",
    weight: 26,
    re: /\b(?:can i|could i) do tomorrow\b/i,
  },
  {
    id: "book_me_in",
    label: "Book me in",
    weight: 34,
    re: /\bbook me in\b/i,
  },
  {
    id: "have_time",
    label: "Asked about availability",
    weight: 30,
    re: /\b(?:do you have time|have any time|got time|any availability)\b/i,
  },
  {
    id: "times_available",
    label: "Asked what times are available",
    weight: 32,
    re: /\bwhat times?(?:\s+are)?\s+available\b/i,
  },
  {
    id: "test_drive",
    label: "Test drive request",
    weight: 32,
    re: /\b(?:can i|could i|want to|like to)\s+test drive\b/i,
  },
  {
    id: "schedule_service",
    label: "Schedule service",
    weight: 34,
    re: /\bschedule service\b/i,
  },
  {
    id: "appointment_word",
    label: "Mentioned appointment",
    weight: 22,
    re: /\b(?:an?|the)\s+appointment\b|\bmake an appointment\b|\bbook(?:ing)?\s+an?\s+appointment\b/i,
  },
  {
    id: "schedule_visit",
    label: "Schedule / book a visit",
    weight: 26,
    re: /\b(?:schedule|book)\s+(?:a\s+)?(?:visit|time|slot)\b/i,
  },
  {
    id: "come_in",
    label: "Wants to come in",
    weight: 24,
    re: /\b(?:can i|could i)\s+come in\b/i,
  },
];

const SERVICE_CUES =
  /\b(?:service|oil change|maintenance|tire|brake|alignment|diagnostic|recall|schedule service|book service)\b/i;

const SALES_CUES =
  /\b(?:test drive|vehicle|car|suv|truck|trade|buy|purchase|inventory|rogue|altima|sentra)\b/i;

const DAY_HINT_RE =
  /\b(tomorrow|today|tonight|monday|tuesday|wednesday|thursday|friday|saturday|sunday|this week|next week|this afternoon|this evening|this morning)\b/i;

const TIME_HINT_RE =
  /\b(\d{1,2}\s*(?:am|pm)|morning|afternoon|evening|noon)\b/i;

function confidenceLabel(score: number): AppointmentIntentConfidenceLabel {
  if (score >= 75) return "High";
  if (score >= 45) return "Medium";
  return "Low";
}

function detectDepartment(
  text: string,
  conversationDepartment: StaffDepartment
): AppointmentDepartment | null {
  const service = SERVICE_CUES.test(text);
  const sales = SALES_CUES.test(text);
  if (service && !sales) return "service";
  if (sales && !service) return "sales";
  if (service && sales) {
    if (/\bschedule service\b/i.test(text)) return "service";
    if (/\btest drive\b/i.test(text)) return "sales";
  }
  if (conversationDepartment === "service") return "service";
  if (conversationDepartment === "sales" || conversationDepartment === "bdc") {
    return "sales";
  }
  return null;
}

function formatDayLabel(match: string): string {
  const word = match.toLowerCase();
  if (word === "this afternoon" || word === "this evening" || word === "this morning") {
    return word.replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function proposedTimeLabelFromText(text: string): string | null {
  const day = text.match(DAY_HINT_RE);
  if (day) {
    const label = formatDayLabel(day[1]);
    const time = text.match(TIME_HINT_RE);
    if (time) {
      return `${label} · ${time[1]}`;
    }
    return label;
  }
  if (TIME_HINT_RE.test(text)) {
    return "Time mentioned in chat";
  }
  return null;
}

const WEEKDAYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

function nextWeekday(from: Date, target: (typeof WEEKDAYS)[number]): Date {
  const d = new Date(from);
  const current = d.getDay();
  const want = WEEKDAYS.indexOf(target);
  let delta = want - current;
  if (delta <= 0) delta += 7;
  d.setDate(d.getDate() + delta);
  return d;
}

/** Heuristic local prefill for staff confirm modal — not a booking. */
export function inferProposedDatetimeIso(
  text: string,
  now: Date = new Date()
): string | null {
  const lower = text.toLowerCase();
  const d = new Date(now);

  const setPartOfDay = (date: Date) => {
    if (/\bmorning\b|\bam\b/.test(lower)) {
      date.setHours(9, 0, 0, 0);
    } else if (/\bafternoon\b/.test(lower)) {
      date.setHours(14, 0, 0, 0);
    } else if (/\bevening\b|\bpm\b/.test(lower)) {
      date.setHours(17, 0, 0, 0);
    } else if (/\bnoon\b/.test(lower)) {
      date.setHours(12, 0, 0, 0);
    } else {
      date.setHours(10, 0, 0, 0);
    }
    return date;
  };

  if (/\btomorrow\b/.test(lower)) {
    d.setDate(d.getDate() + 1);
    return setPartOfDay(d).toISOString();
  }
  if (/\btoday\b/.test(lower) || /\btonight\b/.test(lower)) {
    return setPartOfDay(d).toISOString();
  }

  for (const day of WEEKDAYS) {
    if (new RegExp(`\\b${day}\\b`, "i").test(lower)) {
      return setPartOfDay(nextWeekday(now, day)).toISOString();
    }
  }

  if (/\bthis week\b/.test(lower)) {
    d.setDate(d.getDate() + 2);
    return setPartOfDay(d).toISOString();
  }
  if (/\bnext week\b/.test(lower)) {
    d.setDate(d.getDate() + 7);
    return setPartOfDay(d).toISOString();
  }

  return null;
}

export function detectAppointmentIntent(input: {
  customerText: string;
  conversationDepartment: StaffDepartment;
}): AppointmentIntentInsight {
  const text = input.customerText.trim();
  const empty: AppointmentIntentInsight = {
    show: false,
    confidence: 0,
    confidenceLabel: "Low",
    department: null,
    proposedTimeLabel: null,
    proposedDatetimeIso: null,
    matchedSignals: [],
    summary: "",
  };

  if (!text) {
    return empty;
  }

  const matched = INTENT_SIGNALS.filter((s) => s.re.test(text));
  if (matched.length === 0 && !DAY_HINT_RE.test(text)) {
    return empty;
  }

  let confidence = matched.reduce((sum, s) => sum + s.weight, 0);
  if (DAY_HINT_RE.test(text)) {
    confidence += 12;
  }
  if (TIME_HINT_RE.test(text)) {
    confidence += 8;
  }

  const department = detectDepartment(text, input.conversationDepartment);
  if (department) {
    confidence += 8;
  }

  confidence = Math.min(100, confidence);

  if (confidence < 30 && matched.length === 0) {
    return empty;
  }

  const proposedTimeLabel = proposedTimeLabelFromText(text);
  const proposedDatetimeIso = inferProposedDatetimeIso(text);

  const deptLabel = department
    ? APPOINTMENT_DEPARTMENT_LABEL[department]
    : null;

  const summaryParts = [
    matched[0]?.label ?? "Customer is discussing a visit",
    proposedTimeLabel ? `Timing: ${proposedTimeLabel}` : null,
    deptLabel ? `Likely ${deptLabel}` : null,
  ].filter(Boolean);

  return {
    show: true,
    confidence,
    confidenceLabel: confidenceLabel(confidence),
    department,
    proposedTimeLabel,
    proposedDatetimeIso,
    matchedSignals: matched.map((m) => m.label),
    summary: summaryParts.join(" · "),
  };
}
