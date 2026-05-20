import { AlertTriangle } from "lucide-react";

export function SettingsReadOnlyBanner() {
  return (
    <div
      className="border-amber-300/80 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-50 mb-6 flex gap-3 rounded-xl border px-4 py-3 text-sm leading-relaxed"
      role="status"
    >
      <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div>
        <p className="font-medium">View only</p>
        <p className="text-muted-foreground dark:text-amber-100/90 mt-0.5 text-[13px]">
          Only admins and managers can change organization settings. Contact a manager
          if something needs updating.
        </p>
      </div>
    </div>
  );
}
