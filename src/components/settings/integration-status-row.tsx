import { cn } from "@/lib/utils";

export type IntegrationStatusTone = "positive" | "caution" | "neutral";

export function IntegrationStatusRow({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: IntegrationStatusTone;
}) {
  return (
    <div className="border-border/60 flex items-center justify-between gap-4 border-b py-2.5 text-[12px] last:border-b-0 last:pb-0 first:pt-0">
      <span className="text-muted-foreground font-medium">{label}</span>
      <span
        className={cn(
          "shrink-0 font-semibold tracking-tight",
          tone === "positive" && "text-emerald-700 dark:text-emerald-400",
          tone === "caution" && "text-amber-800 dark:text-amber-200",
          tone === "neutral" && "text-foreground/90"
        )}
      >
        {value}
      </span>
    </div>
  );
}
