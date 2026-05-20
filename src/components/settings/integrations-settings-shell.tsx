import type { ReactNode } from "react";

import { DashboardHeader } from "@/components/layout/dashboard-header";

import { IntegrationsSubNav } from "./integrations-subnav";

export function IntegrationsSettingsShell({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <>
      <DashboardHeader title={title} description={description} />
      <div className="border-border bg-muted/12 border-b px-4 py-2.5 sm:px-6">
        <IntegrationsSubNav />
      </div>
      {children}
    </>
  );
}
