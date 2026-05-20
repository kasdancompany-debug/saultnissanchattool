import { DashboardHeader } from "@/components/layout/dashboard-header";
import { ANALYTICS_REPORTING_DAYS } from "@/lib/analytics/constants";

import { OverviewAnalyticsSkeleton } from "./overview-analytics-skeleton";

export default function OverviewLoading() {
  return (
    <>
      <DashboardHeader
        title="Overview"
        description={`Queue health, responsiveness, and channel mix — ${ANALYTICS_REPORTING_DAYS}-day reporting window for ops and leadership.`}
      />
      <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-4 sm:px-6 sm:py-5">
        <OverviewAnalyticsSkeleton />
      </main>
    </>
  );
}
