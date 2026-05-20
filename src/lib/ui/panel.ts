import { cn } from "@/lib/utils";

/**
 * Border + layered shadow — reuse on panels, KPI tiles, and skeletons so elevation stays consistent.
 */
export const cardElevationClassName = cn(
  "border border-border",
  "shadow-[0_1px_2px_rgba(15,23,42,0.06),0_4px_14px_-3px_rgba(15,23,42,0.09),0_16px_40px_-10px_rgba(15,23,42,0.1),0_32px_64px_-18px_rgba(15,23,42,0.075)]",
  "dark:shadow-[0_1px_0_rgba(0,0,0,0.55),0_6px_24px_-4px_rgba(0,0,0,0.58),0_28px_56px_-12px_rgba(0,0,0,0.52),0_44px_88px_-24px_rgba(0,0,0,0.38)]"
);

/** Elevated panel: solid card fill + shared elevation. */
export const cardPanelClassName = cn(
  "bg-card text-card-foreground overflow-hidden rounded-md",
  cardElevationClassName
);

/** Title band — clear floor vs body; sits slightly “in” the card. */
export const cardPanelHeaderClassName = cn(
  "relative flex items-center justify-between gap-2 border-b border-border bg-muted/58 px-3.5 py-2.5 sm:px-4 sm:py-3",
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.55),inset_0_-1px_0_rgba(15,23,42,0.05)] dark:bg-muted/42 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04),inset_0_-1px_0_rgba(0,0,0,0.28)]"
);

export const cardPanelBodyClassName = "px-3.5 py-3 sm:px-4 sm:py-3.5";

/** Main dashboard column: same family as canvas — no grey wash over content. */
export const dashboardMainSurfaceClassName = cn(
  "relative z-0 flex min-w-0 flex-1 flex-col",
  "bg-background shadow-[inset_1px_0_0_rgba(15,23,42,0.04)]",
  "dark:bg-background dark:shadow-[inset_1px_0_0_rgba(255,255,255,0.04),inset_0_1px_0_rgba(0,0,0,0.28)]"
);
