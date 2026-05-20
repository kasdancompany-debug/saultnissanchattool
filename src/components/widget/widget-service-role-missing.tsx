import { cn } from "@/lib/utils";
import {
  cardPanelBodyClassName,
  cardPanelClassName,
  cardPanelHeaderClassName,
} from "@/lib/ui/panel";

export function WidgetServiceRoleMissing() {
  return (
    <div className="min-h-dvh bg-background px-4 py-10 text-foreground">
      <div className={cn(cardPanelClassName, "mx-auto max-w-lg")}>
        <div className={cn(cardPanelHeaderClassName, "flex-col items-stretch gap-0.5 py-1.5")}>
          <h1 className="text-foreground text-[13px] font-bold tracking-[-0.02em]">
            Widget cannot start (server configuration)
          </h1>
          <p className="text-muted-foreground text-[11px] font-normal leading-snug">
            Missing server secret — fix env and restart the dev server.
          </p>
        </div>
        <div className={cn(cardPanelBodyClassName, "space-y-3")}>
          <p className="text-muted-foreground text-[13px] leading-relaxed">
            This page loads dealership business hours using a Supabase{" "}
            <span className="font-medium text-foreground">service role</span> key
            on the server. Your environment is missing{" "}
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
              SUPABASE_SERVICE_ROLE_KEY
            </code>
            .
          </p>
          <ol className="list-decimal space-y-2 pl-5 text-[13px] leading-relaxed text-muted-foreground">
            <li>
              In Supabase:{" "}
              <span className="font-medium text-foreground">
                Project Settings → API
              </span>{" "}
              → copy the{" "}
              <span className="font-medium text-foreground">service_role</span>{" "}
              secret key.
            </li>
            <li>
              Add it to{" "}
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
                .env.local
              </code>{" "}
              (never commit this value), then restart{" "}
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
                npm run dev
              </code>
              .
            </li>
          </ol>
        </div>
      </div>
    </div>
  );
}
