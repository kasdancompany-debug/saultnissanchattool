import { cn } from "@/lib/utils";
import {
  cardPanelBodyClassName,
  cardPanelClassName,
  cardPanelHeaderClassName,
} from "@/lib/ui/panel";

export function PlaceholderPanel({
  eyebrow,
  title,
  children,
}: {
  eyebrow?: string;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={cardPanelClassName}>
      <div className={cn(cardPanelHeaderClassName, "flex-col items-stretch gap-0.5 py-1.5")}>
        {eyebrow ? (
          <p className="text-muted-foreground text-[9px] font-semibold tracking-[0.12em] uppercase">
            {eyebrow}
          </p>
        ) : null}
        <h2 className="text-foreground text-[13px] font-bold tracking-[-0.025em]">{title}</h2>
      </div>
      <div
        className={cn(
          cardPanelBodyClassName,
          "text-muted-foreground/85 py-4 text-[12px] font-normal leading-relaxed"
        )}
      >
        {children ?? (
          <p>Content will appear here once this area is wired up.</p>
        )}
      </div>
    </div>
  );
}
