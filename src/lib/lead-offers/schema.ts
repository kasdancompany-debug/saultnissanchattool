import { z } from "zod";

const departmentEnum = z.enum([
  "sales",
  "service",
  "parts",
  "bdc",
  "management",
  "general",
]);

const emptyToNull = (v: unknown) => {
  if (v === "" || v === null || v === undefined) return null;
  if (typeof v !== "string") return v;
  const t = v.trim();
  return t === "" ? null : t;
};

export const leadOfferFormSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1, "Offer name is required").max(120),
  description: z.string().trim().max(2000).default(""),
  is_active: z
    .union([z.literal("on"), z.literal("true"), z.literal("false"), z.literal("")])
    .optional()
    .transform((v) => v === "on" || v === "true"),
  department: departmentEnum,
  priority: z.coerce.number().int().min(0).max(1000).default(50),
  starts_at: z.preprocess(emptyToNull, z.string().optional().nullable()),
  ends_at: z.preprocess(emptyToNull, z.string().optional().nullable()),
  cta_text: z.string().trim().max(120).default(""),
});

export type LeadOfferFormValues = z.infer<typeof leadOfferFormSchema>;
