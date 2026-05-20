/**
 * Prevents redundant `router.refresh()` bursts when a staff action already
 * refreshed the inbox RSC tree and Supabase Realtime fires for the same write.
 *
 * Call `markInboxClientRefreshed` only after intentional client refreshes from
 * inbox UI actions (composer, toolbar). Do not call it from the realtime bridge.
 */
const SUPPRESS_REALTIME_REFRESH_MS = 450;

let lastClientRefreshAt = 0;

export function markInboxClientRefreshed(): void {
  lastClientRefreshAt = Date.now();
}

export function shouldSuppressRealtimeInboxRefresh(): boolean {
  return Date.now() - lastClientRefreshAt < SUPPRESS_REALTIME_REFRESH_MS;
}
