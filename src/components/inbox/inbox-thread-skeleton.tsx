import { Skeleton } from "@/components/ui/skeleton";

export function InboxThreadSkeleton() {
  return (
    <section className="bg-background/40 flex min-h-0 min-w-0 flex-1 flex-col">
      <header className="from-muted/30 shrink-0 bg-gradient-to-b to-transparent px-4 py-3.5 sm:px-5">
        <div className="flex flex-wrap items-start gap-4">
          <Skeleton className="size-11 shrink-0 rounded-sm" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-6 w-48 max-w-full" />
            <Skeleton className="h-4 w-64 max-w-full" />
            <Skeleton className="h-4 w-56 max-w-full" />
          </div>
        </div>
      </header>
      <div className="flex min-h-0 flex-1 flex-col gap-3 px-4 py-4 sm:px-5 sm:py-4">
        <Skeleton className="h-14 w-full max-w-xl rounded-sm" />
        <Skeleton className="ml-auto h-14 w-full max-w-xl rounded-sm" />
        <Skeleton className="h-14 w-full max-w-xl rounded-sm" />
        <Skeleton className="h-14 w-full max-w-xl rounded-sm" />
      </div>
      <div className="shrink-0 bg-background/80 p-4 shadow-[0_-10px_28px_-12px_rgba(15,23,42,0.07)]">
        <Skeleton className="h-20 w-full rounded-sm" />
      </div>
    </section>
  );
}
