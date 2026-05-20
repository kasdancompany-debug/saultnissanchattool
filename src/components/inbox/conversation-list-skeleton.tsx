import { Skeleton } from "@/components/ui/skeleton";

export function ConversationListSkeleton() {
  return (
    <aside className="relative z-[1] flex min-h-0 w-full min-w-[320px] max-w-[440px] flex-col bg-muted/12 shadow-[8px_0_40px_-14px_rgba(15,23,42,0.1),4px_0_24px_-16px_rgba(15,23,42,0.06),inset_1px_0_0_rgba(15,23,42,0.035)]">
      <div className="from-muted/28 shrink-0 space-y-2 bg-gradient-to-b to-transparent px-4 py-3 sm:px-5">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-3 w-full max-w-xs" />
      </div>
      <div className="flex flex-col gap-2 p-2.5 sm:gap-2.5 sm:p-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-[92px] w-full rounded-sm sm:h-[100px]" />
        ))}
      </div>
    </aside>
  );
}
