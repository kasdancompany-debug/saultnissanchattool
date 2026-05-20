/**
 * Formats seconds as a compact duration for executive summaries.
 */
export function formatDurationSeconds(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "—";
  }
  const s = Math.round(seconds);
  if (s < 60) {
    return `${s}s`;
  }
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m < 60) {
    return r === 0 ? `${m}m` : `${m}m ${r.toString().padStart(2, "0")}s`;
  }
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return `${h}h ${rm}m`;
}
