import Link from "next/link";
import { ArrowRight, MessageCircle, Radio, Route, Users } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function InboxSelectConversationEmpty({
  widgetHref,
  showAdminSettingsLinks = false,
}: {
  widgetHref: string;
  showAdminSettingsLinks?: boolean;
}) {
  return (
    <div className="from-muted/15 via-background to-background flex min-h-0 min-w-0 flex-1 flex-col items-center justify-center bg-gradient-to-b px-4 py-8 text-center sm:px-8 sm:py-10">
      <div className="bg-muted/60 relative mb-6 flex size-14 items-center justify-center rounded-md shadow-[0_2px_8px_-2px_rgba(15,23,42,0.08)]">
        <Radio
          className="text-muted-foreground size-6 animate-pulse opacity-70"
          strokeWidth={1.35}
          aria-hidden
        />
        <span className="bg-primary absolute -top-0.5 -right-0.5 size-2 rounded-full ring-2 ring-background" />
      </div>

      <div className="max-w-md space-y-2.5">
        <h2 className="text-foreground text-[1rem] font-bold tracking-[-0.02em] sm:text-[1.1rem]">
          Choose a conversation
        </h2>
        <p className="text-muted-foreground text-[13px] leading-snug">
          Threads from SMS and web chat appear in the list on the left. Select one to read the full
          transcript, assign ownership, and reply in context — everything stays in one place.
        </p>
      </div>

      <div className="mt-8 w-full max-w-md space-y-3 text-left">
        <p className="text-muted-foreground text-[9px] font-medium tracking-[0.12em] uppercase">
          Quick actions
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          <Link
            href={widgetHref}
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "h-auto justify-start gap-3 py-3 pr-3 pl-3.5 text-left font-normal"
            )}
          >
            <MessageCircle className="text-primary size-4 shrink-0" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="text-foreground block text-sm font-medium">Open test widget</span>
              <span className="text-muted-foreground block text-xs">Send yourself a thread</span>
            </span>
            <ArrowRight className="text-muted-foreground size-4 shrink-0 opacity-60" aria-hidden />
          </Link>
          {showAdminSettingsLinks ? (
            <>
              <Link
                href="/settings/routing"
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  "h-auto justify-start gap-3 py-3 pr-3 pl-3.5 text-left font-normal"
                )}
              >
                <Route className="text-primary size-4 shrink-0" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="text-foreground block text-sm font-medium">
                    Routing &amp; web chat
                  </span>
                  <span className="text-muted-foreground block text-xs">Where chat appears</span>
                </span>
                <ArrowRight
                  className="text-muted-foreground size-4 shrink-0 opacity-60"
                  aria-hidden
                />
              </Link>
              <Link
                href="/settings/team"
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  "h-auto justify-start gap-3 py-3 pr-3 pl-3.5 text-left font-normal sm:col-span-2"
                )}
              >
                <Users className="text-primary size-4 shrink-0" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="text-foreground block text-sm font-medium">
                    Team &amp; coverage
                  </span>
                  <span className="text-muted-foreground block text-xs">Who can respond</span>
                </span>
                <ArrowRight
                  className="text-muted-foreground size-4 shrink-0 opacity-60"
                  aria-hidden
                />
              </Link>
            </>
          ) : null}
        </div>
      </div>

      <p className="text-muted-foreground mt-8 max-w-sm text-[11px] leading-snug">
        <span className="text-foreground/90 font-medium">First time here?</span> Start with a test
        message from the widget, then refresh this inbox — your thread should jump to the top by
        activity.
      </p>
    </div>
  );
}
