import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import {
  cardPanelBodyClassName,
  cardPanelClassName,
  cardPanelHeaderClassName,
} from "@/lib/ui/panel";

export function SettingsSectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className={cardPanelClassName}>
      <div className={cn(cardPanelHeaderClassName, "flex-col items-stretch gap-1 py-2")}>
        <h2 className="text-foreground text-[13px] font-bold tracking-[-0.025em]">{title}</h2>
        {description ? (
          <p className="text-muted-foreground/75 max-w-2xl text-[10px] font-normal leading-relaxed">
            {description}
          </p>
        ) : null}
      </div>
      <div className={cardPanelBodyClassName}>{children}</div>
    </section>
  );
}
