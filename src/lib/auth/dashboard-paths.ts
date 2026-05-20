/**
 * URL prefixes for the `(dashboard)` route group. Next.js route groups do not appear in the
 * path — these are the real first segments (e.g. `/inbox`, `/settings/team`).
 *
 * When adding a new top-level dashboard section, register its `/${segment}` here so
 * {@link isDashboardPathname} and middleware stay aligned with `app/(dashboard)/`.
 */
export const DASHBOARD_PATH_PREFIXES = [
  "/overview",
  "/inbox",
  "/settings",
] as const;

export type DashboardPathPrefix = (typeof DASHBOARD_PATH_PREFIXES)[number];

export function isDashboardPathname(pathname: string): boolean {
  return DASHBOARD_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}
