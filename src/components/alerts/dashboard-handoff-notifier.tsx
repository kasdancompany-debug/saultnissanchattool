"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, Bell, X } from "lucide-react";

import { useHandoffRealtime } from "@/hooks/use-handoff-realtime";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Listens for AI → human handoffs and surfaces urgent in-app alerts. */
export function DashboardHandoffNotifier({
  dealershipId,
  enabled = true,
}: {
  dealershipId: string;
  enabled?: boolean;
}) {
  const { alerts, dismissAlert } = useHandoffRealtime(dealershipId, enabled);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | "unsupported">(
    "default"
  );

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setNotifPermission("unsupported");
      return;
    }
    setNotifPermission(Notification.permission);
  }, []);

  const requestDesktopNotif = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    const p = await Notification.requestPermission();
    setNotifPermission(p);
  };

  if (alerts.length === 0 && notifPermission !== "default") {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[100] flex flex-col gap-2 p-3 sm:p-4">
      <div className="pointer-events-auto mx-auto flex w-full max-w-lg flex-col gap-2">
        {notifPermission === "default" ? (
          <div
            className={cn(
              "flex items-center gap-2.5 rounded-lg border px-3 py-2.5 shadow-lg backdrop-blur-sm",
              "border-primary/25 bg-primary/[0.06]"
            )}
          >
            <Bell className="text-primary size-4 shrink-0" aria-hidden />
            <p className="text-foreground min-w-0 flex-1 text-[12px] leading-snug">
              <span className="font-semibold">Enable desktop alerts</span> so you never miss when AI
              hands a customer to the team.
            </p>
            <button
              type="button"
              onClick={() => void requestDesktopNotif()}
              className={cn(buttonVariants({ size: "sm", variant: "default" }), "shrink-0")}
            >
              Turn on
            </button>
          </div>
        ) : null}

        {alerts.map((alert) => (
          <div
            key={alert.id}
            role="alert"
            className={cn(
              "flex items-center gap-2.5 rounded-lg border px-3 py-2.5 shadow-lg backdrop-blur-sm",
              "border-rose-300/80 bg-rose-50 text-rose-950 dark:border-rose-900/60 dark:bg-rose-950/50 dark:text-rose-50"
            )}
          >
            <AlertCircle className="size-4 shrink-0 text-rose-600 dark:text-rose-300" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-bold leading-tight">Customer needs a human</p>
              <p className="mt-0.5 text-[11px] font-medium leading-snug opacity-90">
                {alert.title?.trim() || "Web chat"} · {alert.department} · just now
              </p>
            </div>
            <Link
              href={alert.inboxHref}
              className={cn(
                buttonVariants({ size: "sm", variant: "default" }),
                "shrink-0 bg-rose-700 hover:bg-rose-800 dark:bg-rose-600 dark:hover:bg-rose-500"
              )}
            >
              Open in inbox
            </Link>
            <button
              type="button"
              onClick={() => dismissAlert(alert.id)}
              className="text-rose-800/80 hover:text-rose-950 dark:text-rose-200/80 dark:hover:text-rose-50 shrink-0 rounded p-1"
              aria-label="Dismiss alert"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
