import "server-only";

import type { Json } from "@/integrations/supabase/database.types";
import { createSupabaseAdminClient } from "@/integrations/supabase/admin";
import { parseBusinessHoursConfig } from "@/lib/business-hours/parse-config";
import type { BusinessHoursConfigV1 } from "@/lib/business-hours/types";

export type DealershipWidgetBundle = {
  dealershipId: string;
  name: string;
  slug: string;
  timezone: string;
  businessHours: BusinessHoursConfigV1;
};

/**
 * Loads dealership row + parsed `business_hours` for the public web widget.
 */
export async function getDealershipWidgetBundleBySlug(
  slug: string
): Promise<DealershipWidgetBundle | null> {
  const supabase = createSupabaseAdminClient();
  const res = await supabase
    .from("dealerships")
    .select("id, name, slug, timezone, business_hours")
    .eq("slug", slug.trim().toLowerCase())
    .maybeSingle();

  if (res.error || !res.data?.id) {
    return null;
  }

  const row = res.data;
  const businessHours = parseBusinessHoursConfig(
    row.business_hours as Json,
    row.timezone
  );

  return {
    dealershipId: row.id,
    name: row.name,
    slug: row.slug ?? slug,
    timezone: row.timezone,
    businessHours,
  };
}

/**
 * Fallback widget dealership when a slug is missing/invalid in development onboarding.
 */
export async function getFirstDealershipWidgetBundle(): Promise<DealershipWidgetBundle | null> {
  const supabase = createSupabaseAdminClient();
  const res = await supabase
    .from("dealerships")
    .select("id, name, slug, timezone, business_hours")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (res.error || !res.data?.id) {
    return null;
  }

  const row = res.data;
  const businessHours = parseBusinessHoursConfig(
    row.business_hours as Json,
    row.timezone
  );

  return {
    dealershipId: row.id,
    name: row.name,
    slug: row.slug ?? "dealership",
    timezone: row.timezone,
    businessHours,
  };
}

/**
 * Dev-only safety: create a minimal dealership for local widget testing when none exists.
 * Never used in production.
 */
export async function ensureDevWidgetDealershipBundle(
  desiredSlug: string
): Promise<DealershipWidgetBundle | null> {
  if (process.env.NODE_ENV === "production") {
    return null;
  }

  const sanitizedSlug =
    desiredSlug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-") || "dev-widget";

  const existingBySlug = await getDealershipWidgetBundleBySlug(sanitizedSlug);
  if (existingBySlug) {
    return existingBySlug;
  }

  const first = await getFirstDealershipWidgetBundle();
  if (first) {
    return first;
  }

  const supabase = createSupabaseAdminClient();
  const inserted = await supabase
    .from("dealerships")
    .insert({
      name: "Dev Widget Dealership",
      slug: sanitizedSlug,
      timezone: "America/Toronto",
      business_hours: {},
      metadata: { source: "dev_widget_autoseed" },
    })
    .select("id, name, slug, timezone, business_hours")
    .single();

  if (inserted.error || !inserted.data) {
    return null;
  }

  const row = inserted.data;
  const businessHours = parseBusinessHoursConfig(
    row.business_hours as Json,
    row.timezone
  );

  return {
    dealershipId: row.id,
    name: row.name,
    slug: row.slug ?? sanitizedSlug,
    timezone: row.timezone,
    businessHours,
  };
}
