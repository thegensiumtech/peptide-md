/**
 * Demo clock.
 *
 * Every screen reads "now" from here rather than calling Date.now(). With
 * static fixtures that keeps server and client rendering identical (no
 * hydration mismatch) and keeps the demo stable — "upcoming" always means the
 * same set of appointments. Replacing the fixtures with live endpoints means
 * deleting this and using the real clock.
 */
export const NOW_ISO = '2026-08-09T09:00:00.000Z';

export const now = () => new Date(NOW_ISO);

/** Current billing period, 'YYYY-MM'. */
export const CURRENT_PERIOD = NOW_ISO.slice(0, 7);

export function addDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
}

export function addMinutes(iso: string, minutes: number): string {
  return new Date(new Date(iso).getTime() + minutes * 60_000).toISOString();
}

/** Build a UTC instant from a calendar date and a 24-hour time. */
export function at(date: string, time: string): string {
  return new Date(`${date}T${time}:00.000Z`).toISOString();
}
