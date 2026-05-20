import { Skeleton } from "@/components/ui/skeleton";

/** Reserves space while orphan detection runs — avoids a flash of empty chrome. */
export function InboxOrphanSlotSkeleton() {
  return (
    <div className="shrink-0 bg-muted/25 px-4 py-2 sm:px-6" aria-hidden>
      <Skeleton className="mx-auto h-3 max-w-xl rounded-full opacity-40" />
    </div>
  );
}
