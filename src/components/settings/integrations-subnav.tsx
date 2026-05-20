"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

import { cn } from "@/lib/utils";

const links = [
  { href: "/settings/integrations", label: "Overview", exact: true },
  { href: "/settings/integrations/twilio", label: "Twilio", exact: false },
  { href: "/settings/integrations/meta", label: "Meta", exact: false },
] as const;

export function IntegrationsSubNav() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    for (const item of links) {
      router.prefetch(item.href);
    }
  }, [router]);

  return (
    <nav
      aria-label="Integrations sections"
      className="flex flex-wrap gap-1.5"
    >
      {links.map((item) => {
        const active = item.exact
          ? pathname === item.href
          : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "rounded-md px-2.5 py-1.5 text-[11px] font-semibold tracking-tight transition-[background-color,color,box-shadow] duration-150 ease-out motion-reduce:transition-none",
              active
                ? "bg-primary/[0.1] text-foreground ring-1 ring-primary/15 shadow-sm"
                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
