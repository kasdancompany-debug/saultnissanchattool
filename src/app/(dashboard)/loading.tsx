import { DashboardShellSkeleton } from "@/components/layout/dashboard-shell-skeleton";

/** Instant UI while a dashboard child route (e.g. inbox) resolves its RSC tree. */
export default function DashboardLoading() {
  return <DashboardShellSkeleton />;
}
