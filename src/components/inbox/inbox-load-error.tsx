import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function InboxLoadError({
  message,
  digest,
}: {
  message: string;
  digest?: string;
}) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-8 py-16 text-center">
      <div className="max-w-md space-y-2">
        <h2 className="text-foreground text-lg font-semibold tracking-tight">
          Inbox could not be loaded
        </h2>
        <p className="text-muted-foreground text-sm leading-relaxed">{message}</p>
        {digest ? (
          <p className="text-muted-foreground font-mono text-[11px]">Reference: {digest}</p>
        ) : null}
      </div>
      <a
        href="/inbox?filter=all_open"
        className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
      >
        Open All Open inbox
      </a>
    </div>
  );
}
