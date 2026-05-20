export function DashboardHeader({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <header className="relative z-10 flex shrink-0 flex-col gap-0.5 bg-card px-4 py-3 shadow-[0_1px_0_rgba(15,23,42,0.05),0_10px_32px_-8px_rgba(15,23,42,0.14),0_24px_48px_-16px_rgba(15,23,42,0.08)] sm:px-6 sm:py-3.5 dark:shadow-[0_1px_0_rgba(0,0,0,0.45),0_12px_40px_-8px_rgba(0,0,0,0.65)]">
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="text-foreground text-[1.5rem] font-bold tracking-[-0.045em] sm:text-[1.75rem] lg:text-[1.875rem]">
          {title}
        </h1>
        <span className="text-muted-foreground hidden text-[8px] font-bold tracking-[0.18em] uppercase sm:inline">
          Internal
        </span>
      </div>
      {description ? (
        <p className="text-muted-foreground max-w-2xl text-[10px] font-medium leading-snug">
          {description}
        </p>
      ) : null}
    </header>
  );
}
