/**
 * Visual tokens for embeddable dealership chat UIs.
 * Pass partial overrides via {@link DealerChatWidget} `brand` prop on any site.
 */
export type WidgetBrandTokens = {
  /** Header title (e.g. dealership name). */
  title: string;
  /** Short line under title in header. */
  tagline: string;
  /** Primary brand color (buttons, customer bubbles, launcher). */
  primary: string;
  /** Hover / pressed state for primary. */
  primaryHover: string;
  /** Header gradient start. */
  headerFrom: string;
  /** Header gradient mid. */
  headerVia: string;
  /** Header gradient end. */
  headerTo: string;
};

export const SAULT_NISSAN_WIDGET_BRAND: WidgetBrandTokens = {
  title: "Sault Nissan",
  tagline: "We’re here to help",
  primary: "#c8102e",
  primaryHover: "#a00d26",
  headerFrom: "#18181b",
  headerVia: "#0f172a",
  headerTo: "#18181b",
};

export function mergeWidgetBrand(
  partial?: Partial<WidgetBrandTokens>
): WidgetBrandTokens {
  if (!partial) {
    return { ...SAULT_NISSAN_WIDGET_BRAND };
  }
  return { ...SAULT_NISSAN_WIDGET_BRAND, ...partial };
}
