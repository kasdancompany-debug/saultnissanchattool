import type { Metadata } from "next";

import { DealerChatWidget } from "@/components/widget/dealer-chat-widget";
import { parseBusinessHoursConfig } from "@/lib/business-hours/parse-config";
import { publicEnv } from "@/lib/env/public";
import { isInboundOpenAiConfigured } from "@/lib/env/inbound-classification-config";
import {
  ensureDevWidgetDealershipBundle,
  getDealershipWidgetBundleBySlug,
  getFirstDealershipWidgetBundle,
} from "@/server/data/dealership-business-hours";

export const metadata: Metadata = {
  title: "Chat",
  robots: { index: false, follow: false },
};

export default async function WidgetPage({
  searchParams,
}: {
  searchParams: Promise<{ slug?: string; preview?: string; open?: string }>;
}) {
  const params = await searchParams;
  const raw = params.slug?.trim();
  const slug = (
    raw && raw.length > 0 ? raw : publicEnv.NEXT_PUBLIC_WIDGET_DEALERSHIP_SLUG
  ).toLowerCase();
  const openAiConfigured = isInboundOpenAiConfigured();
  /** Centered full-panel demo only — website iframe embed uses default floating launcher. */
  const previewMode =
    params.preview === "1" || params.preview === "true";
  /** Only full-page preview auto-opens; iframe visitors use the launcher → topic menu. */
  const openOnLoad = previewMode;

  try {
    const requested = await getDealershipWidgetBundleBySlug(slug);
    const bundle =
      requested ??
      (slug !== publicEnv.NEXT_PUBLIC_WIDGET_DEALERSHIP_SLUG
        ? await getDealershipWidgetBundleBySlug(
            publicEnv.NEXT_PUBLIC_WIDGET_DEALERSHIP_SLUG
          )
        : null) ??
      (await getFirstDealershipWidgetBundle()) ??
      (await ensureDevWidgetDealershipBundle(slug));

    if (bundle) {
      return (
        <DealerChatWidget
          dealershipSlug={bundle.slug}
          businessHoursConfig={bundle.businessHours}
          defaultOpen={openOnLoad}
          presentation={previewMode ? "page" : "embed"}
          openAiConfigured={openAiConfigured}
        />
      );
    }
  } catch {
    // In local dev, avoid blocking widget boot on server-secret read failures.
  }

  const fallbackSlug = slug || publicEnv.NEXT_PUBLIC_WIDGET_DEALERSHIP_SLUG;
  const fallbackHours = parseBusinessHoursConfig({}, "America/Toronto");

  return (
    <DealerChatWidget
      dealershipSlug={fallbackSlug}
      businessHoursConfig={fallbackHours}
      defaultOpen={openOnLoad}
      presentation={previewMode ? "page" : "embed"}
      openAiConfigured={openAiConfigured}
    />
  );
}
