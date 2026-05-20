import { businessHoursConfigV1Schema } from "@/lib/business-hours/schema";
import type { BusinessHoursConfigV1, WeekdayKey, WeeklySchedule } from "@/lib/business-hours/types";

const DAYS: WeekdayKey[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

/** `type="time"` may return HH:mm:ss — schema expects HH:mm. */
function toHHmm(raw: string): string {
  const t = raw.trim();
  if (t.length >= 5) {
    return t.slice(0, 5);
  }
  return t;
}

/**
 * Builds web_chat schedule from admin settings form fields (`wc_*`).
 */
export function businessHoursConfigFromFormData(
  formData: FormData
): { ok: true; data: BusinessHoursConfigV1 } | { ok: false; error: string } {
  const timezone = String(formData.get("timezone") ?? "").trim();
  if (!timezone) {
    return { ok: false, error: "Timezone is required." };
  }

  const web: WeeklySchedule = {
    mon: null,
    tue: null,
    wed: null,
    thu: null,
    fri: null,
    sat: null,
    sun: null,
  };

  for (const d of DAYS) {
    const closed = formData.get(`wc_${d}_closed`) === "on";
    if (closed) {
      web[d] = null;
      continue;
    }
    const open = toHHmm(String(formData.get(`wc_${d}_open`) ?? "09:00"));
    const close = toHHmm(String(formData.get(`wc_${d}_close`) ?? "17:00"));
    web[d] = { open, close };
  }

  const config: BusinessHoursConfigV1 = {
    version: 1,
    timezone,
    schedules: { web_chat: web },
  };

  const parsed = businessHoursConfigV1Schema.safeParse(config);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return {
      ok: false,
      error: first?.message ?? "Invalid business hours.",
    };
  }

  return { ok: true, data: parsed.data };
}
