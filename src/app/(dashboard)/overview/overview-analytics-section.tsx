import { ExecutiveOverviewDashboard } from "@/components/analytics/executive-overview-dashboard";
import { getSession, requireStaff } from "@/server/auth/staff";
import { loadDealershipAnalytics } from "@/server/data/analytics";

/**
 * Heavy overview body: `requireStaff` + analytics run here so the page shell + header stream first.
 */
export async function OverviewAnalyticsSection() {
  const staff = await requireStaff();
  const { supabase } = await getSession();
  const analyticsRes = await loadDealershipAnalytics(staff.dealership_id, supabase);

  if (!analyticsRes.ok) {
    return (
      <div
        className="border-destructive/30 bg-destructive/5 text-destructive rounded-sm border px-3 py-2.5 text-xs font-medium"
        role="alert"
      >
        Could not load analytics: {analyticsRes.error.message}
      </div>
    );
  }

  return (
    <ExecutiveOverviewDashboard data={analyticsRes.data} />
  );
}
