import { Suspense } from "react";

import { DashboardAlertsShell } from "@/components/alerts/dashboard-alerts-shell";
import { DashboardShellSkeleton } from "@/components/layout/dashboard-shell-skeleton";
import { DashboardSidebar } from "@/components/layout/dashboard-sidebar";
import { dashboardMainSurfaceClassName } from "@/lib/ui/panel";
import { requireStaff } from "@/server/auth/staff";

/**
 * Enforces staff access for every dashboard URL (`/overview`, `/inbox`, `/settings/*`).
 * Middleware provides a first line of defense; this layout is the required server-side gate
 * (do not rely on middleware alone).
 *
 * The shell streams first: {@link requireStaff} runs inside Suspense so navigation after login
 * can paint a structural skeleton while session + staff resolve, instead of blocking the
 * entire dashboard on a blank frame.
 */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<DashboardShellSkeleton />}>
      <DashboardAuthShell>{children}</DashboardAuthShell>
    </Suspense>
  );
}

async function DashboardAuthShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const staff = await requireStaff();

  return (
    <DashboardAlertsShell dealershipId={staff.dealership_id}>
      <div className="bg-background flex min-h-screen">
        <DashboardSidebar
          dealershipName={staff.dealership.name}
          dealershipId={staff.dealership_id}
          staffUserId={staff.id}
          staffRole={staff.role}
          staffEmail={staff.email}
          staffName={staff.display_name}
        />
        <div className={dashboardMainSurfaceClassName}>{children}</div>
      </div>
    </DashboardAlertsShell>
  );
}
