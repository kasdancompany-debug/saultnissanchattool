import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

function Shell({ className }: { className?: string }) {
  return (
    <Skeleton
      className={cn(
        "rounded-xl border border-border/40 bg-card/60",
        className
      )}
    />
  );
}

export function OverviewAnalyticsSkeleton() {
  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="space-y-2">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-10 w-48 max-w-full" />
        <Skeleton className="h-4 w-64 max-w-full" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3 2xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Shell key={i} className="h-36 sm:h-40" />
        ))}
      </div>
      <Shell className="h-56 sm:h-64" />
      <Shell className="h-48 sm:h-56" />
    </div>
  );
}
