/** Display label for inbox appointment cards. */
export function formatAppointmentDisplay(
  iso: string | null | undefined
): string | null {
  if (!iso?.trim()) {
    return null;
  }
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return null;
  }
}

/** `datetime-local` input value from ISO. */
export function toDatetimeLocalValue(iso: string | null | undefined): string {
  if (!iso?.trim()) {
    return "";
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return "";
  }
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Parse `datetime-local` form value to ISO for API. */
/** Split ISO into HTML `date` / `time` input values (local timezone). */
export function splitIsoToDateAndTime(iso: string | null | undefined): {
  date: string;
  time: string;
} {
  if (!iso?.trim()) {
    return { date: "", time: "" };
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return { date: "", time: "" };
  }
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

/** Combine HTML date + time fields into ISO (local → UTC). */
export function combineDateAndTimeToIso(date: string, time: string): string | null {
  const d = date.trim();
  const t = time.trim();
  if (!d || !t) {
    return null;
  }
  return parseDatetimeLocalToIso(`${d}T${t}`);
}

export function parseDatetimeLocalToIso(value: string): string | null {
  const t = value.trim();
  if (!t) {
    return null;
  }
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) {
    return null;
  }
  return d.toISOString();
}

export function notesPreview(text: string | null | undefined, max = 120): string | null {
  if (!text?.trim()) {
    return null;
  }
  const t = text.trim();
  if (t.length <= max) {
    return t;
  }
  return `${t.slice(0, max - 1)}…`;
}
