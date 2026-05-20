import type { ReactNode } from "react";

export function AuthPageHeader({
  eyebrow = "Staff access",
  title,
  description,
}: {
  eyebrow?: string;
  title: string;
  description: ReactNode;
}) {
  return (
    <header className="mb-7 space-y-2 sm:mb-8">
      <p className="text-primary/90 text-[10px] font-bold tracking-[0.16em] uppercase sm:text-[11px]">
        {eyebrow}
      </p>
      <h2 className="text-foreground text-[1.3125rem] font-bold tracking-[-0.035em] sm:text-[1.4375rem] sm:leading-tight">
        {title}
      </h2>
      <div className="text-muted-foreground space-y-2 text-sm font-normal leading-relaxed">
        {description}
      </div>
    </header>
  );
}
