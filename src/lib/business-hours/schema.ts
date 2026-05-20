import { z } from "zod";

import type { BusinessHoursConfigV1 } from "./types";

const hhmm = z
  .string()
  .regex(/^\d{2}:\d{2}$/, "Expected HH:mm")
  .refine((s) => {
    const [h, m] = s.split(":").map(Number);
    return h >= 0 && h <= 23 && m >= 0 && m <= 59;
  }, "Invalid time");

const dayWindow = z.union([
  z.object({ open: hhmm, close: hhmm }),
  z.null(),
]);

const weeklySchedule = z.object({
  mon: dayWindow,
  tue: dayWindow,
  wed: dayWindow,
  thu: dayWindow,
  fri: dayWindow,
  sat: dayWindow,
  sun: dayWindow,
});

export const businessHoursConfigV1Schema = z
  .object({
    version: z.literal(1),
    timezone: z.string().min(1).max(120),
    schedules: z
      .object({
        web_chat: weeklySchedule,
        sales: weeklySchedule.optional(),
        service: weeklySchedule.optional(),
        parts: weeklySchedule.optional(),
        bdc: weeklySchedule.optional(),
        management: weeklySchedule.optional(),
        general: weeklySchedule.optional(),
      })
      .strict(),
  })
  .superRefine((val, ctx) => {
    const check = (label: keyof BusinessHoursConfigV1["schedules"], sched: typeof val.schedules.web_chat) => {
      for (const day of Object.keys(sched) as (keyof typeof sched)[]) {
        const w = sched[day];
        if (w === null) {
          continue;
        }
        const [oh, om] = w.open.split(":").map(Number);
        const [ch, cm] = w.close.split(":").map(Number);
        const o = oh * 60 + om;
        const c = ch * 60 + cm;
        if (c <= o) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Close must be after open on ${String(day)} (overnight shifts not supported yet)`,
            path: ["schedules", label, day],
          });
        }
      }
    };
    check("web_chat", val.schedules.web_chat);
    const optionalKeys = [
      "sales",
      "service",
      "parts",
      "bdc",
      "management",
      "general",
    ] as const;
    for (const k of optionalKeys) {
      const s = val.schedules[k];
      if (s) {
        check(k, s);
      }
    }
  });

export type ParsedBusinessHoursConfig = z.infer<typeof businessHoursConfigV1Schema>;
