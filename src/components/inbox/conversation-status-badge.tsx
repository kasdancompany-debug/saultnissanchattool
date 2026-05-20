import type { ConversationStatus } from "@/integrations/supabase/database.types";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import { formatStatusLabel } from "./inbox-labels";

export function ConversationStatusBadge({
  status,
  className,
}: {
  status: ConversationStatus;
  className?: string;
}) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "font-semibold",
        status === "open" && "border-emerald-500/35 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100",
        status === "pending" && "border-amber-500/35 bg-amber-500/10 text-amber-950 dark:text-amber-100",
        status === "waiting_for_human" &&
          "border-violet-500/35 bg-violet-500/10 text-violet-950 dark:text-violet-100",
        status === "resolved" && "border-sky-500/35 bg-sky-500/10 text-sky-950 dark:text-sky-100",
        status === "closed" && "border-border bg-muted/60 text-muted-foreground",
        status === "archived" && "border-border bg-muted/40 text-muted-foreground",
        status === "spam" && "border-destructive/30 bg-destructive/10 text-destructive",
        className
      )}
    >
      {formatStatusLabel(status)}
    </Badge>
  );
}
