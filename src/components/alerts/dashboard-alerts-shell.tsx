"use client";

import { DashboardHandoffNotifier } from "@/components/alerts/dashboard-handoff-notifier";

export function DashboardAlertsShell({
  dealershipId,
  children,
}: {
  dealershipId: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <DashboardHandoffNotifier dealershipId={dealershipId} />
      {children}
    </>
  );
}
