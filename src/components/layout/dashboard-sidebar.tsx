"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Inbox, LayoutGrid, Settings } from "lucide-react";

import { LogoutButton } from "@/components/auth/logout-button";
import { canViewDealershipWideInbox } from "@/lib/inbox/filter-access";
import type { StaffRole } from "@/integrations/supabase/database.types";
import { useInboxQueueCounts } from "@/components/inbox/use-inbox-queue-counts";

import { cn } from "@/lib/utils";

const nav = [
  { href: "/overview", label: "Overview", Icon: LayoutGrid },
  { href: "/inbox", label: "Inbox", Icon: Inbox },
  { href: "/settings", label: "Settings", Icon: Settings },
] as const;

export function DashboardSidebar({
  dealershipName,
  dealershipId,
  staffUserId,
  staffRole,
  staffName,
  staffEmail,
}: {
  dealershipName: string;
  dealershipId: string;
  staffUserId: string;
  staffRole: StaffRole;
  staffName: string;
  staffEmail: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const canViewAll = canViewDealershipWideInbox(staffRole);
  const { counts } = useInboxQueueCounts(
    dealershipId,
    staffUserId,
    45_000,
    canViewAll
  );
  const needsHumanBadge = counts.waitingHuman > 0 ? counts.waitingHuman : 0;

  useEffect(() => {
    for (const item of nav) {
      router.prefetch(item.href);
    }
  }, [router]);

  useEffect(() => {
    setPendingHref(null);
  }, [pathname]);

  return (
    <aside className="relative z-[1] flex w-[13.25rem] shrink-0 flex-col bg-sidebar text-sidebar-foreground shadow-[8px_0_36px_-14px_rgba(15,23,42,0.11),4px_0_20px_-12px_rgba(15,23,42,0.06)] dark:shadow-[8px_0_40px_-12px_rgba(0,0,0,0.55)]">
      <div className="flex h-10 items-center gap-2 px-2 pb-2 pt-1">
        <div
          className="border-sidebar-primary/85 size-[7px] shrink-0 rounded-[2px] border bg-sidebar-primary shadow-[0_0_0_1px_rgba(15,23,42,0.04)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.06)]"
          aria-hidden
        />
        <div className="min-w-0">
          <p className="truncate text-[12px] font-semibold leading-none tracking-[-0.02em]">
            {dealershipName}
          </p>
          <p className="text-muted-foreground mt-0.5 truncate text-[8px] font-semibold leading-none tracking-[0.14em] uppercase">
            Communications
          </p>
        </div>
      </div>

      <nav aria-label="Main" className="flex flex-1 flex-col gap-px px-2 py-2">
        {nav.map((item) => {
          const routeActive =
            pathname === item.href ||
            (item.href !== "/overview" && pathname.startsWith(item.href));
          const active = routeActive || pendingHref === item.href;
          const Icon = item.Icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch
              onClick={() => {
                if (!routeActive) {
                  setPendingHref(item.href);
                }
              }}
              className={cn(
                "group relative flex min-h-8 items-center gap-2 rounded-md px-2 py-1.5 text-[12px] leading-none tracking-[-0.012em] transition-[background-color,color,box-shadow,border-color] duration-150 ease-out motion-reduce:transition-none",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring/55 focus-visible:ring-offset-0",
                active
                  ? cn(
                      "bg-primary/[0.07] font-semibold text-sidebar-foreground ring-1 ring-inset ring-primary/12 shadow-[0_1px_4px_rgba(15,23,42,0.06)]",
                      "dark:bg-primary/[0.14] dark:ring-primary/22 dark:shadow-[0_2px_10px_rgba(0,0,0,0.4)]"
                    )
                  : "font-medium text-sidebar-foreground/72 hover:bg-primary/[0.04] hover:text-sidebar-foreground dark:hover:bg-primary/[0.08]"
              )}
            >
              {active ? (
                <span
                  aria-hidden
                  className="bg-sidebar-primary absolute top-1/2 left-1 z-[1] h-5 w-[3px] -translate-y-1/2 rounded-full shadow-[0_0_0_1px_rgba(255,255,255,0.35)] dark:shadow-[0_0_0_1px_rgba(0,0,0,0.2)]"
                />
              ) : null}
              <Icon
                className={cn(
                  "relative z-[2] size-3.5 shrink-0 transition-[color,opacity] duration-150 ease-out motion-reduce:transition-none",
                  active
                    ? "text-sidebar-primary"
                    : "text-sidebar-foreground/55 group-hover:text-sidebar-foreground/85"
                )}
                aria-hidden
              />
              <span className="relative z-[2] min-w-0 truncate">{item.label}</span>
              {item.href === "/inbox" && needsHumanBadge > 0 ? (
                <span
                  className="relative z-[2] ml-auto rounded-full bg-rose-600 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-white"
                  aria-label={`${needsHumanBadge} need human`}
                >
                  {needsHumanBadge > 99 ? "99+" : needsHumanBadge}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto space-y-2 rounded-t-lg bg-muted/15 px-2 py-2.5">
        <p className="text-muted-foreground px-0.5 text-[10px] leading-snug">
          <span className="text-sidebar-foreground font-semibold">{staffName}</span>
          <br />
          <span className="font-normal">{staffEmail}</span>
        </p>
        <LogoutButton className="h-7 justify-start px-2 text-[12px] font-medium text-sidebar-foreground/78 hover:bg-primary/[0.06] hover:text-sidebar-foreground dark:hover:bg-primary/[0.1]" />
      </div>
    </aside>
  );
}
