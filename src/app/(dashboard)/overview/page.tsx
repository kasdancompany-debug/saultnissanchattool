import type { Metadata } from "next";
import { Suspense } from "react";

import { OverviewAnalyticsSection } from "./overview-analytics-section";
import { OverviewAnalyticsSkeleton } from "./overview-analytics-skeleton";

export const metadata: Metadata = {
  title: "Overview",
};

export const dynamic = "force-dynamic";

export default function OverviewPage() {
  return (
    <>
      <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-5 sm:px-8 sm:py-8">
        <Suspense fallback={<OverviewAnalyticsSkeleton />}>
          <OverviewAnalyticsSection />
        </Suspense>
      </main>
    </>
  );
}
