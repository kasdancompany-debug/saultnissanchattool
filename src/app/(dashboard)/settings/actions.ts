"use server";

import { revalidatePath } from "next/cache";

import type { Json } from "@/integrations/supabase/database.types";
import { createSupabaseServerClient } from "@/integrations/supabase/server";
import { businessHoursConfigFromFormData } from "@/lib/settings/business-hours-from-form";
import {
  aiPromptPlaceholdersV1Schema,
  dealershipProfileFormSchema,
  patchDealershipSettingsV1,
  routingSettingsV1Schema,
  twilioPublicFormSchema,
} from "@/lib/settings/dealership-settings-v1";
import { requireStaff } from "@/server/auth/staff";
import { leadOfferFormSchema } from "@/lib/lead-offers/schema";
import { parseFormDateTime } from "@/lib/lead-offers/form-datetime";
import { staffCanEditDealershipSettings } from "@/server/settings/staff-privilege";
import { deleteLeadOffer, upsertLeadOffer } from "@/server/data/lead-offers";

export type SettingsActionState = {
  ok: boolean;
  error: string | null;
  message?: string | null;
};

export const settingsInitialState: SettingsActionState = {
  ok: false,
  error: null,
};

function forbidden(): SettingsActionState {
  return { ok: false, error: "You do not have permission to change settings." };
}

function firstZodMessage(err: { issues: { message: string }[] }): string {
  return err.issues[0]?.message ?? "Invalid input.";
}

export async function updateDealershipProfileAction(
  _prevState: SettingsActionState,
  formData: FormData
): Promise<SettingsActionState> {
  const staff = await requireStaff();
  if (!staffCanEditDealershipSettings(staff)) {
    return forbidden();
  }

  const parsed = dealershipProfileFormSchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    timezone: formData.get("timezone"),
  });
  if (!parsed.success) {
    return { ok: false, error: firstZodMessage(parsed.error) };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("dealerships")
    .update({
      name: parsed.data.name,
      slug: parsed.data.slug,
      timezone: parsed.data.timezone,
      updated_at: new Date().toISOString(),
    })
    .eq("id", staff.dealership_id);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/settings", "layout");
  return { ok: true, error: null, message: "Profile saved." };
}

export async function updateBusinessHoursAction(
  _prevState: SettingsActionState,
  formData: FormData
): Promise<SettingsActionState> {
  const staff = await requireStaff();
  if (!staffCanEditDealershipSettings(staff)) {
    return forbidden();
  }

  const built = businessHoursConfigFromFormData(formData);
  if (!built.ok) {
    return { ok: false, error: built.error };
  }

  const supabase = await createSupabaseServerClient();
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("dealerships")
    .update({
      business_hours: built.data as unknown as Json,
      timezone: built.data.timezone,
      updated_at: now,
    })
    .eq("id", staff.dealership_id);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/settings", "layout");
  return { ok: true, error: null, message: "Business hours saved." };
}

export async function updateRoutingSettingsAction(
  _prevState: SettingsActionState,
  formData: FormData
): Promise<SettingsActionState> {
  const staff = await requireStaff();
  if (!staffCanEditDealershipSettings(staff)) {
    return forbidden();
  }

  const parsed = routingSettingsV1Schema.safeParse({
    web_chat_default_department: formData.get("web_chat_default_department"),
    intake_routing_notes: formData.get("intake_routing_notes"),
  });
  if (!parsed.success) {
    return { ok: false, error: firstZodMessage(parsed.error) };
  }

  const supabase = await createSupabaseServerClient();
  const { data: row, error: loadErr } = await supabase
    .from("dealerships")
    .select("metadata")
    .eq("id", staff.dealership_id)
    .single();

  if (loadErr || !row) {
    return { ok: false, error: loadErr?.message ?? "Could not load dealership." };
  }

  const metadata = patchDealershipSettingsV1(row.metadata as Json, {
    routing: parsed.data,
  });

  const { error } = await supabase
    .from("dealerships")
    .update({ metadata, updated_at: new Date().toISOString() })
    .eq("id", staff.dealership_id);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/settings", "layout");
  return { ok: true, error: null, message: "Routing settings saved." };
}

export async function updateAiPromptPlaceholdersAction(
  _prevState: SettingsActionState,
  formData: FormData
): Promise<SettingsActionState> {
  const staff = await requireStaff();
  if (!staffCanEditDealershipSettings(staff)) {
    return forbidden();
  }

  const parsed = aiPromptPlaceholdersV1Schema.safeParse({
    dealership_context: formData.get("dealership_context"),
    brand_voice_line: formData.get("brand_voice_line"),
  });
  if (!parsed.success) {
    return { ok: false, error: firstZodMessage(parsed.error) };
  }

  const supabase = await createSupabaseServerClient();
  const { data: row, error: loadErr } = await supabase
    .from("dealerships")
    .select("metadata")
    .eq("id", staff.dealership_id)
    .single();

  if (loadErr || !row) {
    return { ok: false, error: loadErr?.message ?? "Could not load dealership." };
  }

  const metadata = patchDealershipSettingsV1(row.metadata as Json, {
    ai: parsed.data,
  });

  const { error } = await supabase
    .from("dealerships")
    .update({ metadata, updated_at: new Date().toISOString() })
    .eq("id", staff.dealership_id);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/settings", "layout");
  return { ok: true, error: null, message: "AI prompt placeholders saved." };
}

export async function updateTwilioPublicSettingsAction(
  _prevState: SettingsActionState,
  formData: FormData
): Promise<SettingsActionState> {
  const staff = await requireStaff();
  if (!staffCanEditDealershipSettings(staff)) {
    return forbidden();
  }

  const parsed = twilioPublicFormSchema.safeParse({
    twilio_phone_e164: formData.get("twilio_phone_e164"),
    integration_notes: formData.get("integration_notes"),
  });
  if (!parsed.success) {
    return { ok: false, error: firstZodMessage(parsed.error) };
  }

  const supabase = await createSupabaseServerClient();
  const { data: row, error: loadErr } = await supabase
    .from("dealerships")
    .select("metadata")
    .eq("id", staff.dealership_id)
    .single();

  if (loadErr || !row) {
    return { ok: false, error: loadErr?.message ?? "Could not load dealership." };
  }

  const metadata = patchDealershipSettingsV1(row.metadata as Json, {
    twilio: { integration_notes: parsed.data.integration_notes ?? "" },
  });

  const { error } = await supabase
    .from("dealerships")
    .update({
      twilio_phone_e164: parsed.data.twilio_phone_e164,
      metadata,
      updated_at: new Date().toISOString(),
    })
    .eq("id", staff.dealership_id);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/settings", "layout");
  return { ok: true, error: null, message: "Twilio settings saved." };
}

export async function saveLeadOfferAction(
  _prevState: SettingsActionState,
  formData: FormData
): Promise<SettingsActionState> {
  const staff = await requireStaff();
  if (!staffCanEditDealershipSettings(staff)) {
    return forbidden();
  }

  const parsed = leadOfferFormSchema.safeParse({
    id: formData.get("id") || undefined,
    name: formData.get("name"),
    description: formData.get("description"),
    is_active: formData.get("is_active"),
    department: formData.get("department"),
    priority: formData.get("priority"),
    starts_at: formData.get("starts_at"),
    ends_at: formData.get("ends_at"),
    cta_text: formData.get("cta_text"),
  });
  if (!parsed.success) {
    return { ok: false, error: firstZodMessage(parsed.error) };
  }

  const startsAt = parseFormDateTime(parsed.data.starts_at);
  const endsAt = parseFormDateTime(parsed.data.ends_at);
  if (startsAt && endsAt && new Date(endsAt) < new Date(startsAt)) {
    return { ok: false, error: "End date must be on or after start date." };
  }

  const res = await upsertLeadOffer(
    staff.dealership_id,
    {
      name: parsed.data.name,
      description: parsed.data.description,
      is_active: parsed.data.is_active,
      department: parsed.data.department,
      priority: parsed.data.priority,
      starts_at: startsAt,
      ends_at: endsAt,
      cta_text: parsed.data.cta_text,
    },
    parsed.data.id ?? null
  );

  if (!res.ok) {
    return { ok: false, error: res.error.message };
  }

  revalidatePath("/settings/lead-offers");
  revalidatePath("/overview");
  return {
    ok: true,
    error: null,
    message: parsed.data.id ? "Offer updated." : "Offer created.",
  };
}

export async function deleteLeadOfferAction(
  _prevState: SettingsActionState,
  formData: FormData
): Promise<SettingsActionState> {
  const staff = await requireStaff();
  if (!staffCanEditDealershipSettings(staff)) {
    return forbidden();
  }

  const id = String(formData.get("id") ?? "").trim();
  if (!id) {
    return { ok: false, error: "Offer id is required." };
  }

  const res = await deleteLeadOffer(staff.dealership_id, id);
  if (!res.ok) {
    return { ok: false, error: res.error.message };
  }

  revalidatePath("/settings/lead-offers");
  revalidatePath("/overview");
  return { ok: true, error: null, message: "Offer deleted." };
}

