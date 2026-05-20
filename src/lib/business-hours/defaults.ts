import type { BusinessHoursConfigV1 } from "@/lib/business-hours/types";

const weekdayOpen: { open: string; close: string } = {
  open: "09:00",
  close: "18:00",
};

/** Default Mon–Fri 9–6, weekends closed — aligned with previous widget constants. */
export const DEFAULT_BUSINESS_HOURS_TORONTO: BusinessHoursConfigV1 = {
  version: 1,
  timezone: "America/Toronto",
  schedules: {
    web_chat: {
      mon: weekdayOpen,
      tue: weekdayOpen,
      wed: weekdayOpen,
      thu: weekdayOpen,
      fri: weekdayOpen,
      sat: null,
      sun: null,
    },
  },
};
