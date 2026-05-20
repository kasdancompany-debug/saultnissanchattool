import { Skeleton } from "@/components/ui/skeleton";
import { cardElevationClassName, dashboardMainSurfaceClassName } from "@/lib/ui/panel";
import { cn } from "@/lib/utils";

/**
 * Shown while the dashboard shell resolves staff (layout) or while a child route segment loads.
 */
export function DashboardShellSkeleton() {
  return (
    <div className="bg-background flex min-h-screen">
      <aside className="bg-sidebar text-sidebar-foreground relative z-[1] hidden w-[13.25rem] shrink-0 flex-col shadow-[8px_0_36px_-14px_rgba(15,23,42,0.11),4px_0_20px_-12px_rgba(15,23,42,0.06)] md:flex dark:shadow-[8px_0_40px_-12px_rgba(0,0,0,0.55)]">
        <Skeleton className="mx-2 my-2.5 h-8 rounded-md bg-sidebar-accent/45" />
        <div className="flex flex-col gap-px px-2 py-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full rounded-md bg-sidebar-accent/35" />
          ))}
        </div>
        <div className="mt-auto space-y-2 rounded-t-lg bg-muted/15 px-2 py-2.5">
          <Skeleton className="mx-0.5 h-3 w-[75%] bg-sidebar-accent/35" />
          <Skeleton className="mx-0.5 h-3 w-1/2 bg-sidebar-accent/30" />
          <Skeleton className="h-7 w-full rounded-md bg-sidebar-accent/30" />
        </div>
      </aside>
      <div className={dashboardMainSurfaceClassName}>
        <header className="relative z-10 shrink-0 bg-card px-4 py-3 shadow-[0_1px_0_rgba(15,23,42,0.05),0_10px_32px_-8px_rgba(15,23,42,0.14),0_24px_48px_-16px_rgba(15,23,42,0.08)] sm:px-6 dark:shadow-[0_1px_0_rgba(0,0,0,0.45),0_12px_40px_-8px_rgba(0,0,0,0.65)]">
          <Skeleton className="h-7 w-48 max-w-[60%]" />
          <Skeleton className="mt-1.5 h-3.5 w-full max-w-xl" />
        </header>
        <div className="flex-1 space-y-4 px-4 py-4 sm:px-6 sm:py-5">
          <div className="grid auto-rows-fr gap-3 sm:grid-cols-2 sm:gap-3.5 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton
                key={i}
                className={cn(
                  "h-[12.5rem] rounded-md bg-gradient-to-b from-primary/[0.06] to-card dark:from-primary/[0.1]",
                  cardElevationClassName
                )}
              />
            ))}
          </div>
          <Skeleton className={cn("h-44 w-full max-w-4xl rounded-md bg-card", cardElevationClassName)} />
        </div>
      </div>
    </div>
  );
}
