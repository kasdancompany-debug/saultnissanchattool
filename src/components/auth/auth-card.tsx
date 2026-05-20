import { cn } from "@/lib/utils";
import { cardPanelClassName } from "@/lib/ui/panel";

const authCardShellClassName = cn(
  cardPanelClassName,
  "overflow-hidden rounded-lg text-card-foreground"
);

const authCardBodyClassName = "relative px-8 py-9 sm:px-10 sm:py-10";

export function AuthCard({
  children,
  className,
}: {
  children: React.ReactNode;
  /** Optional extra classes on the card shell. */
  className?: string;
}) {
  return (
    <div className="flex w-full max-w-[460px] flex-col items-stretch">
      <div className={cn(authCardShellClassName, className)}>
        <div
          aria-hidden
          className="from-primary/25 via-primary to-primary/25 h-[3px] w-full bg-gradient-to-r"
        />
        <div className={authCardBodyClassName}>{children}</div>
      </div>
    </div>
  );
}

export function AuthCardFooter({ children }: { children: React.ReactNode }) {
  return <div className="mt-8 space-y-3 pt-1">{children}</div>;
}

/** Secondary actions panel (e.g. sign out as different user). */
export const authAuxiliaryPanelClassName = cn(
  "bg-muted/40 rounded-md px-3 py-2.5 shadow-[inset_0_1px_2px_rgba(15,23,42,0.04)]"
);
