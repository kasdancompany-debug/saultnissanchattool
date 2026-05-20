import { z } from "zod";

import type { Json } from "@/integrations/supabase/database.types";
import type { StaffDepartment } from "@/integrations/supabase/database.types";

const departmentEnum = z.enum([
  "sales",
  "service",
  "parts",
  "bdc",
  "management",
  "general",
]);

/**
 * Stored under `dealerships.metadata.settings_v1` for expandable admin config.
 * Never put API secrets here — only public notes and routing preferences.
 */
export const routingSettingsV1Schema = z.object({
  web_chat_default_department: departmentEnum.default("general"),
  /** Freeform routing guidance for staff (future automation / rules engine). */
  intake_routing_notes: z.string().max(2000).optional().default(""),
});

export const aiPromptPlaceholdersV1Schema = z.object({
  /** Injected into AI prompts in a future release — dealership facts, policies, tone. */
  dealership_context: z.string().max(4000).optional().default(""),
  /** Short brand voice line for drafts. */
  brand_voice_line: z.string().max(500).optional().default(""),
});

export const twilioPlaceholdersV1Schema = z.object({
  /** Internal notes only — never store Account SID / Auth Token here. */
  integration_notes: z.string().max(2000).optional().default(""),
});

export const dealershipSettingsV1Schema = z.object({
  version: z.literal(1),
  routing: routingSettingsV1Schema.optional(),
  ai: aiPromptPlaceholdersV1Schema.optional(),
  twilio: twilioPlaceholdersV1Schema.optional(),
});

export type DealershipSettingsV1 = z.infer<typeof dealershipSettingsV1Schema>;
export type RoutingSettingsV1 = z.infer<typeof routingSettingsV1Schema>;
export type AiPromptPlaceholdersV1 = z.infer<typeof aiPromptPlaceholdersV1Schema>;
export type TwilioPlaceholdersV1 = z.infer<typeof twilioPlaceholdersV1Schema>;

/** Fully populated defaults for UI and server actions (nested keys always present). */
export type ResolvedDealershipSettingsV1 = {
  version: 1;
  routing: RoutingSettingsV1;
  ai: AiPromptPlaceholdersV1;
  twilio: TwilioPlaceholdersV1;
};

const defaultSettingsV1: ResolvedDealershipSettingsV1 = {
  version: 1,
  routing: {
    web_chat_default_department: "general",
    intake_routing_notes: "",
  },
  ai: {
    dealership_context: "",
    brand_voice_line: "",
  },
  twilio: {
    integration_notes: "",
  },
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

/**
 * Parses `metadata.settings_v1` with defaults for missing/invalid data.
 */
export function parseDealershipSettingsV1(
  metadata: Json
): ResolvedDealershipSettingsV1 {
  if (!isRecord(metadata)) {
    return { ...defaultSettingsV1 };
  }
  const raw = metadata.settings_v1;
  const parsed = dealershipSettingsV1Schema.safeParse(raw);
  if (!parsed.success) {
    return { ...defaultSettingsV1 };
  }
  return {
    ...defaultSettingsV1,
    ...parsed.data,
    routing: routingSettingsV1Schema.parse({
      ...defaultSettingsV1.routing,
      ...(parsed.data.routing ?? {}),
    }),
    ai: aiPromptPlaceholdersV1Schema.parse({
      ...defaultSettingsV1.ai,
      ...(parsed.data.ai ?? {}),
    }),
    twilio: twilioPlaceholdersV1Schema.parse({
      ...defaultSettingsV1.twilio,
      ...(parsed.data.twilio ?? {}),
    }),
  };
}

/**
 * Deep-merge partial settings into existing metadata JSON for PATCH-style updates.
 */
export function patchDealershipSettingsV1(
  metadata: Json,
  patch: Partial<ResolvedDealershipSettingsV1>
): Json {
  const current = parseDealershipSettingsV1(metadata);
  const next: ResolvedDealershipSettingsV1 = {
    version: 1,
    routing: patch.routing
      ? { ...current.routing, ...patch.routing }
      : current.routing,
    ai: patch.ai ? { ...current.ai, ...patch.ai } : current.ai,
    twilio: patch.twilio
      ? { ...current.twilio, ...patch.twilio }
      : current.twilio,
  };
  const base = isRecord(metadata) ? { ...metadata } : {};
  return { ...base, settings_v1: next } as Json;
}

export const dealershipProfileFormSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  slug: z
    .string()
    .trim()
    .max(120)
    .refine(
      (s) => s === "" || /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s),
      "Slug: lowercase letters, numbers, and single hyphens only"
    )
    .transform((s) => (s === "" ? null : s)),
  timezone: z.string().trim().min(1, "Timezone is required").max(120),
});

export const twilioPublicFormSchema = z.object({
  twilio_phone_e164: z
    .string()
    .trim()
    .refine(
      (s) => s === "" || /^\+[1-9]\d{6,14}$/.test(s),
      "Use E.164 format (e.g. +17055550100) or leave blank"
    )
    .transform((s) => (s === "" ? null : s)),
  integration_notes: z.string().max(2000).optional().default(""),
});

export function formatStaffDepartment(d: StaffDepartment): string {
  const labels: Record<StaffDepartment, string> = {
    sales: "Sales",
    service: "Service",
    parts: "Parts",
    bdc: "BDC",
    management: "Management",
    general: "General",
  };
  return labels[d] ?? d;
}

export function formatStaffRole(role: string): string {
  const labels: Record<string, string> = {
    admin: "Admin",
    manager: "Manager",
    advisor: "Advisor",
    bdc: "BDC",
    readonly: "Read-only",
  };
  return labels[role] ?? role;
}
