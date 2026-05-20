import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { cardElevationClassName } from "@/lib/ui/panel";
import { cn } from "@/lib/utils";

import type { IntegrationStatusTone } from "./integration-status-row";

const toneRing: Record<IntegrationStatusTone, string> = {
  positive: "ring-emerald-500/25",
  caution: "ring-amber-500/30",
  neutral: "ring-border/80",
};

const toneDot: Record<IntegrationStatusTone, string> = {
  positive: "bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.2)]",
  caution: "bg-amber-500 shadow-[0_0_0_3px_rgba(245,158,11,0.22)]",
  neutral: "bg-muted-foreground/40",
};

export function IntegrationHubLinkCard({
  href,
  title,
  description,
  statusLabel,
  statusTone,
}: {
  href: string;
  title: string;
  description: string;
  statusLabel: string;
  statusTone: IntegrationStatusTone;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "bg-card text-card-foreground group relative block rounded-xl p-4 transition-[box-shadow,transform,border-color] duration-200 ease-out",
        cardElevationClassName,
        "hover:border-primary/22 hover:-translate-y-px hover:shadow-[0_2px_6px_rgba(15,23,42,0.08),0_12px_36px_-8px_rgba(15,23,42,0.12)]",
        "dark:hover:shadow-[0_2px_8px_rgba(0,0,0,0.45),0_20px_48px_-12px_rgba(0,0,0,0.55)]",
        "ring-1 ring-inset",
        toneRing[statusTone]
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex items-center gap-2">
            <span
              className={cn("size-2 shrink-0 rounded-full", toneDot[statusTone])}
              aria-hidden
            />
            <h2 className="text-foreground text-[14px] font-bold tracking-[-0.02em]">{title}</h2>
          </div>
          <p className="text-muted-foreground text-[11px] font-medium leading-relaxed">
            {description}
          </p>
          <p className="text-foreground pt-0.5 text-[11px] font-semibold">{statusLabel}</p>
        </div>
        <ArrowRight className="text-muted-foreground group-hover:text-primary size-4 shrink-0 transition-colors" aria-hidden />
      </div>
      <p className="text-muted-foreground/80 mt-3 text-[10px] font-medium tracking-tight">
        Configure routing and identifiers
      </p>
    </Link>
  );
}
