/**
 * How a set's last edit reads in a list. Records store an ISO timestamp;
 * older ones (and the sample's) hold a display string, shown as it is.
 */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/** "Just now", "5 min ago", "3h ago", "Yesterday", "6 Mar", "6 Mar 2025". */
export function formatUpdated(value: string, now: number): string {
  if (!/^\d{4}-\d{2}-\d{2}T/.test(value)) return value;
  const t = Date.parse(value);
  if (Number.isNaN(t)) return value;
  const ago = now - t;
  if (ago < MINUTE) return "Just now";
  if (ago < HOUR) return `${Math.floor(ago / MINUTE)} min ago`;
  const then = new Date(t);
  const today = new Date(now);
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  if (t >= startOfToday) return `${Math.floor(ago / HOUR)}h ago`;
  if (t >= startOfToday - 24 * HOUR) return "Yesterday";
  const day = `${then.getDate()} ${MONTHS[then.getMonth()]}`;
  return then.getFullYear() === today.getFullYear() ? day : `${day} ${then.getFullYear()}`;
}
