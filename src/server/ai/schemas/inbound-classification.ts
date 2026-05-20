import { z } from "zod";

/** Matches `StaffDepartment` for routing suggestions. */
export const aiDepartmentSchema = z.enum([
  "sales",
  "service",
  "parts",
  "bdc",
  "management",
  "general",
]);

export const aiUrgencySchema = z.enum(["low", "normal", "high", "urgent"]);

export const aiSentimentSchema = z.enum([
  "positive",
  "neutral",
  "negative",
  "unknown",
]);

/**
 * Model output before business-rule overrides (strongly typed).
 */
export const inboundClassificationModelSchema = z.object({
  intent: z.string().min(1).max(500),
  department: aiDepartmentSchema,
  urgency: aiUrgencySchema,
  sentiment: aiSentimentSchema,
  /** Model self-reported confidence 0–1. */
  confidence: z.coerce.number().min(0).max(1),
  recommended_action: z.string().min(1).max(2000),
  escalate_to_human: z.coerce.boolean(),
  /**
   * Short, safe reply staff may edit; must not promise numbers or approvals.
   */
  safe_draft_reply: z.string().min(1).max(4000),
  /** Best-effort extracted CRM fields (null when unknown). */
  customer_profile: z
    .object({
      name: z.string().trim().min(1).max(120).nullable(),
      email: z.string().email().max(320).nullable(),
      phone_e164: z
        .string()
        .regex(/^\+[1-9]\d{6,14}$/)
        .nullable(),
    })
    .default({
      name: null,
      email: null,
      phone_e164: null,
    }),
});

export type InboundClassificationModelOutput = z.infer<
  typeof inboundClassificationModelSchema
>;

/**
 * Stored on `message_ai_runs.structured_output` after rule application.
 */
export const inboundClassificationRuleIdSchema = z.enum([
  "low_confidence",
  "negative_sentiment",
  "model_escalation",
  "handoff_language",
  "unsafe_draft_redacted",
]);

export const inboundClassificationStoredSchema = z.object({
  prompt_version: z.string(),
  model: z.string(),
  parsed: inboundClassificationModelSchema,
  /** After confidence + sentiment + draft-safety rules. */
  escalate_to_human_effective: z.boolean(),
  rules_applied: z.array(inboundClassificationRuleIdSchema),
  /** Set when the model JSON failed schema validation. */
  parse_error: z.string().optional(),
  /** Present when {@link applyInboundDraftSafety} replaced a risky draft. */
  draft_safety: z
    .object({
      redacted: z.boolean(),
      triggers: z.array(z.string()).optional(),
    })
    .optional(),
});

export type InboundClassificationStored = z.infer<
  typeof inboundClassificationStoredSchema
>;
