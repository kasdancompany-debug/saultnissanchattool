"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Building2,
  Clock,
  GitBranch,
  Megaphone,
  Plug,
  Settings2,
  Sparkles,
  Users,
  Wrench,
} from "lucide-react";

import { cn } from "@/lib/utils";

const links = [
  { href: "/settings/profile", label: "Profile", icon: Building2 },
  { href: "/settings/hours", label: "Business hours", icon: Clock },
  { href: "/settings/routing", label: "Routing", icon: GitBranch },
  {
    href: "/settings/service-scheduling",
    label: "Service scheduling",
    icon: Wrench,
  },
  { href: "/settings/ai", label: "AI prompts", icon: Sparkles },
  { href: "/settings/lead-offers", label: "Lead offers", icon: Megaphone },
  { href: "/settings/integrations", label: "Integrations", icon: Plug },
  { href: "/settings/team", label: "Team", icon: Users },
] as const;

export function SettingsSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  useEffect(() => {
    for (const item of links) {
      router.prefetch(item.href);
    }
  }, [router]);

  useEffect(() => {
    setPendingHref(null);
  }, [pathname]);

  return (
    <aside className="relative z-[1] w-[208px] shrink-0 bg-muted/22 px-2 py-5 shadow-[8px_0_36px_-14px_rgba(15,23,42,0.08),4px_0_20px_-12px_rgba(15,23,42,0.04),inset_1px_0_0_rgba(15,23,42,0.035)] dark:bg-muted/14 dark:shadow-[8px_0_40px_-12px_rgba(0,0,0,0.5),inset_1px_0_0_rgba(255,255,255,0.04)]">
      <div className="text-muted-foreground mb-3 flex items-center gap-2 px-1.5 text-[9px] font-bold tracking-[0.14em] uppercase">
        <Settings2 className="size-3 shrink-0 opacity-70" aria-hidden />
        Admin
      </div>
      <nav aria-label="Settings sections" className="flex flex-col gap-px">
        {links.map((item) => {
          const routeActive =
            pathname === item.href ||
            (item.href !== "/settings/profile" && pathname.startsWith(item.href));
          const active = routeActive || pendingHref === item.href;
          const Icon = item.icon;
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
                "group flex items-center gap-2 rounded-sm px-2 py-1.5 text-[11px] font-semibold transition-[background-color,color,box-shadow,border-color] duration-150 ease-out motion-reduce:transition-none",
                active
                  ? "bg-primary/[0.08] text-foreground ring-1 ring-inset ring-primary/14 shadow-[0_1px_3px_rgba(15,23,42,0.05)] dark:bg-primary/[0.14] dark:ring-primary/22"
                  : "text-muted-foreground hover:bg-primary/[0.04] hover:text-foreground dark:hover:bg-primary/[0.08]"
              )}
            >
              <Icon
                className={cn(
                  "size-3 shrink-0 transition-colors",
                  active ? "text-primary" : "text-muted-foreground group-hover:text-primary/80"
                )}
                aria-hidden
              />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
