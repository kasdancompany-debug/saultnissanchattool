import { Skeleton } from "@/components/ui/skeleton";
import {
  cardPanelBodyClassName,
  cardPanelClassName,
  cardPanelHeaderClassName,
} from "@/lib/ui/panel";
import { cn } from "@/lib/utils";

/** Settings content area while the next settings page RSC resolves. */
export function SettingsRouteSkeleton() {
  return (
    <>
      <header className="relative z-10 flex shrink-0 flex-col gap-0.5 bg-card px-4 py-3 shadow-[0_1px_0_rgba(15,23,42,0.05),0_10px_32px_-8px_rgba(15,23,42,0.14),0_24px_48px_-16px_rgba(15,23,42,0.08)] sm:px-6 sm:py-3.5 dark:shadow-[0_1px_0_rgba(0,0,0,0.45),0_12px_40px_-8px_rgba(0,0,0,0.65)]">
        <Skeleton className="h-7 w-52 max-w-[65%] sm:h-8" />
        <Skeleton className="h-3 w-full max-w-lg" />
      </header>
      <main className="flex-1 space-y-4 px-4 py-4 sm:px-6 sm:py-5">
        <section className={cardPanelClassName}>
          <div className={cn(cardPanelHeaderClassName, "flex-col items-stretch gap-2")}>
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-full max-w-lg" />
          </div>
          <div className={cn(cardPanelBodyClassName, "space-y-3")}>
            <Skeleton className="h-9 w-full max-w-md" />
            <Skeleton className="h-9 w-full max-w-md" />
            <Skeleton className="h-24 w-full max-w-xl" />
          </div>
        </section>
        <section className={cardPanelClassName}>
          <div className={cardPanelHeaderClassName}>
            <Skeleton className="h-4 w-48" />
          </div>
          <div className={cn(cardPanelBodyClassName, "flex flex-wrap gap-2")}>
            <Skeleton className="h-7 w-28 rounded-sm" />
            <Skeleton className="h-7 w-28 rounded-sm" />
          </div>
        </section>
      </main>
    </>
  );
}
