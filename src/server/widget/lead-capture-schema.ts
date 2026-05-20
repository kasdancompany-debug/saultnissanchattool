import { z } from "zod";

const leadIntent = z.enum([
  "new_vehicle",
  "used_vehicle",
  "trade_value",
  "service",
  "financing",
  "general",
]);

const leadCondition = z.enum(["excellent", "good", "fair", "needs_work"]);
const leadTimeline = z.enum([
  "asap",
  "two_weeks",
  "one_to_three_months",
  "browsing",
]);
const leadFinancing = z.enum(["yes", "no", "maybe"]);

const trimOrOmit = (v: unknown) => {
  if (v === "" || v === null || v === undefined) return undefined;
  if (typeof v !== "string") return v;
  const t = v.trim();
  return t === "" ? undefined : t;
};

export const widgetLeadCaptureSchema = z.object({
  intent: leadIntent,
  name: z.preprocess(trimOrOmit, z.string().min(1).max(120)),
  phone_e164: z
    .string()
    .regex(/^\+[1-9]\d{6,14}$/, "phone_e164 must be E.164"),
  email: z.preprocess(
    trimOrOmit,
    z.string().email().max(320).optional()
  ),
  vehicle_interest: z.preprocess(trimOrOmit, z.string().max(500).optional()),
  trade_vehicle: z.preprocess(trimOrOmit, z.string().max(500).optional()),
  trade_year: z.preprocess(trimOrOmit, z.string().max(32).optional()),
  trade_km: z.preprocess(trimOrOmit, z.string().max(32).optional()),
  trade_condition: leadCondition.optional(),
  timeline: leadTimeline.optional(),
  financing_interest: leadFinancing.optional(),
  general_question: z.preprocess(trimOrOmit, z.string().max(2000).optional()),
  service_need: z.preprocess(trimOrOmit, z.string().max(1000).optional()),
});

export type WidgetLeadCaptureInput = z.infer<typeof widgetLeadCaptureSchema>;

export function departmentForLeadIntent(
  intent: WidgetLeadCaptureInput["intent"]
): "sales" | "service" | "general" | "bdc" {
  if (intent === "service") return "service";
  if (intent === "general") return "general";
  return "sales";
}
