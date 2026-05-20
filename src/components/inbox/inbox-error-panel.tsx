import { InboxErrorRetry } from "./inbox-error-retry";

export function InboxErrorPanel({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div
      className="bg-destructive/5 border-destructive/20 flex min-h-[240px] flex-col justify-center rounded-lg border p-6"
      role="alert"
    >
      <p className="text-destructive text-sm font-medium">{title}</p>
      <p className="text-muted-foreground mt-2 text-xs leading-relaxed">
        {description}
      </p>
      <InboxErrorRetry />
    </div>
  );
}
