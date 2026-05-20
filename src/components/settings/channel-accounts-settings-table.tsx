import type { DealershipChannelAccountSettingsRow } from "@/server/data/dealership-channel-accounts";
import { integrationProviderLabel } from "@/lib/settings/integration-providers";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function ChannelAccountsSettingsTable({
  rows,
  emptyHint,
}: {
  rows: DealershipChannelAccountSettingsRow[];
  emptyHint: string;
}) {
  if (rows.length === 0) {
    return (
      <p className="text-muted-foreground border-border/70 rounded-lg border border-dashed px-4 py-8 text-center text-[12px] leading-relaxed">
        {emptyHint}
      </p>
    );
  }

  return (
    <div className="border-border overflow-hidden rounded-lg border">
      <table className="w-full text-left text-[12px]">
        <thead>
          <tr className="bg-muted/35 text-muted-foreground border-b text-[10px] font-bold uppercase tracking-wide">
            <th className="px-3 py-2.5 font-semibold">Channel</th>
            <th className="px-3 py-2.5 font-semibold">Identifier</th>
            <th className="px-3 py-2.5 font-semibold">Label</th>
            <th className="px-3 py-2.5 font-semibold">State</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              className="border-border/80 hover:bg-muted/25 border-b last:border-b-0"
            >
              <td className="text-foreground px-3 py-2.5 font-semibold">
                {integrationProviderLabel(row.provider)}
              </td>
              <td className="px-3 py-2.5">
                <code
                  className="text-foreground/90 bg-muted/50 max-w-[min(280px,55vw)] truncate rounded px-1.5 py-0.5 font-mono text-[11px]"
                  title={row.external_account_id}
                >
                  {row.external_account_id}
                </code>
              </td>
              <td className="text-muted-foreground max-w-[200px] truncate px-3 py-2.5">
                {row.display_label?.trim() ? row.display_label : "—"}
              </td>
              <td className="px-3 py-2.5">
                <Badge
                  variant={row.is_active ? "default" : "secondary"}
                  className={cn(
                    "h-5 text-[10px] font-semibold",
                    row.is_active
                      ? "bg-emerald-600/90 text-white hover:bg-emerald-600 dark:bg-emerald-700"
                      : ""
                  )}
                >
                  {row.is_active ? "Active" : "Inactive"}
                </Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
