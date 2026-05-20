/** Short relative labels for inbox (no external date library). */
export function formatRelativeTime(iso: string | null | undefined): string {
  if (!iso) {
    return "—";
  }
  const d = new Date(iso).getTime();
  if (Number.isNaN(d)) {
    return "—";
  }
  const diffMs = Date.now() - d;
  const sec = Math.floor(diffMs / 1000);
  if (sec < 45) {
    return "Just now";
  }
  const min = Math.floor(sec / 60);
  if (min < 60) {
    return `${min}m ago`;
  }
  const hr = Math.floor(min / 60);
  if (hr < 24) {
    return `${hr}h ago`;
  }
  const day = Math.floor(hr / 24);
  if (day < 7) {
    return `${day}d ago`;
  }
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
  }).format(d);
}

export function formatMessageTimestamp(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) {
    return "";
  }
  return new Intl.DateTimeFormat("en", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(t);
}
