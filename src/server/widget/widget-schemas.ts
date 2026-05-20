import { z } from "zod";

import { widgetLeadCaptureSchema } from "@/server/widget/lead-capture-schema";

const departmentEnum = z.enum([
  "sales",
  "service",
  "parts",
  "bdc",
  "management",
  "general",
]);

const emptyToUndefined = (v: unknown) =>
  v === "" || v === null || v === undefined ? undefined : v;

/** Trim; empty / whitespace-only → undefined (omitted fields). */
const trimOrOmit = (v: unknown) => {
  if (v === "" || v === null || v === undefined) {
    return undefined;
  }
  if (typeof v !== "string") {
    return v;
  }
  const t = v.trim();
  return t === "" ? undefined : t;
};

/**
 * Public widget → `POST /api/widget/conversations`.
 * Slug identifies the dealership; phone/email drive CRM match/creation when present.
 */
export const widgetStartBodySchema = z.object({
  dealership_slug: z
    .string()
    .min(1)
    .max(128)
    .transform((s) => s.trim().toLowerCase())
    .refine((s) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s), {
      message: "dealership_slug must be a lowercase slug",
    }),
  department: departmentEnum.optional(),
  page_path: z.preprocess(trimOrOmit, z.string().max(2000).optional()),
  display_name: z.preprocess(trimOrOmit, z.string().max(120).optional()),
  email: z.preprocess(
    emptyToUndefined,
    z.string().email().max(320).optional()
  ),
  /** E.164 when provided (e.g. +17055550100) */
  phone_e164: z.preprocess(
    emptyToUndefined,
    z
      .string()
      .regex(/^\+[1-9]\d{6,14}$/, "phone_e164 must be E.164")
      .optional()
  ),
  /** Guided intake completed — creates CRM row, conversation metadata, and first message. */
  lead_capture: widgetLeadCaptureSchema.optional(),
});

/**
 * Public widget → `POST /api/widget/conversations/:id/messages`
 */
export const widgetPostMessageBodySchema = z.object({
  text: z
    .string()
    .max(5000)
    .transform((s) => s.trim())
    .pipe(z.string().min(1, "Message cannot be empty")),
});
