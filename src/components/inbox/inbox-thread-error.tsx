import {
  cardPanelBodyClassName,
  cardPanelClassName,
  cardPanelHeaderClassName,
} from "@/lib/ui/panel";
import { cn } from "@/lib/utils";

import { InboxErrorRetry } from "./inbox-error-retry";

export function InboxThreadError({ message }: { message: string }) {
  return (
    <div
      className="bg-muted/15 flex min-h-0 min-w-0 flex-1 flex-col items-center justify-center gap-2 px-6 py-12 text-center"
      role="alert"
    >
      <div className={cn(cardPanelClassName, "max-w-lg text-left")}>
        <div className={cn(cardPanelHeaderClassName, "flex-col items-stretch gap-0.5 py-1.5")}>
          <p className="text-destructive text-[13px] font-bold tracking-[-0.02em]">
            Thread unavailable
          </p>
          <p className="text-muted-foreground text-[11px] font-normal leading-snug">
            Refresh or return to the inbox if this persists.
          </p>
        </div>
        <div className={cn(cardPanelBodyClassName, "space-y-3")}>
          <p className="text-muted-foreground max-w-md text-[13px] leading-snug">{message}</p>
          <InboxErrorRetry />
        </div>
      </div>
    </div>
  );
}
