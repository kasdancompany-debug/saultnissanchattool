import type { Json } from "@/integrations/supabase/database.types";
import type { WidgetLeadCapturePayload } from "@/lib/widget/lead-capture/types";

export function leadCaptureRecord(lead: WidgetLeadCapturePayload): Record<string, unknown> {
  return {
    version: 1,
    completed_at: new Date().toISOString(),
    ...lead,
  };
}

export function mergeLeadIntoConversationMetadata(
  existing: Json,
  lead: WidgetLeadCapturePayload
): Json {
  const base =
    existing && typeof existing === "object" && !Array.isArray(existing)
      ? { ...(existing as Record<string, unknown>) }
      : {};
  const prevWidget =
    base.widget &&
    typeof base.widget === "object" &&
    !Array.isArray(base.widget)
      ? { ...(base.widget as Record<string, unknown>) }
      : {};
  const record = leadCaptureRecord(lead);
  return {
    ...base,
    lead_capture: record,
    widget: {
      ...prevWidget,
      lead_capture: record,
    },
  } as Json;
}
