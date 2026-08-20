/**
 * Formatting helpers.
 *
 * Money is stored in minor units everywhere, so every display of a price goes
 * through formatMoney rather than dividing by 100 inline. Times are stored in
 * UTC and always rendered into an explicit timezone, a patient in Sydney
 * should never have to work out what a London time means for them.
 */

export function formatMoney(minorUnits: number, currency = 'GBP', locale = 'en-GB'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: minorUnits % 100 === 0 ? 0 : 2,
  }).format(minorUnits / 100);
}

export function formatDate(iso: string, timeZone: string, locale = 'en-GB'): string {
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone,
  }).format(new Date(iso));
}

export function formatTime(iso: string, timeZone: string, locale = 'en-GB'): string {
  return new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone,
  }).format(new Date(iso));
}

export function formatDateTime(iso: string, timeZone: string, locale = 'en-GB'): string {
  return `${formatDate(iso, timeZone, locale)} · ${formatTime(iso, timeZone, locale)}`;
}

export function formatWeekday(iso: string, timeZone: string, locale = 'en-GB'): string {
  return new Intl.DateTimeFormat(locale, { weekday: 'long', timeZone }).format(new Date(iso));
}

/** 'Europe/London' -> 'London'. Shown next to every time so the zone is explicit. */
export function timezoneLabel(timeZone: string): string {
  const city = timeZone.split('/').pop() ?? timeZone;
  return city.replace(/_/g, ' ');
}

/** Short UTC-offset badge, e.g. 'GMT+10'. */
export function timezoneAbbreviation(timeZone: string, at: string = new Date().toISOString()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    timeZoneName: 'shortOffset',
  }).formatToParts(new Date(at));
  return parts.find((p) => p.type === 'timeZoneName')?.value ?? '';
}

/** '2026-08' -> 'August 2026' */
export function formatPeriod(period: string, locale = 'en-GB'): string {
  const [year, month] = period.split('-').map(Number);
  return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(
    new Date(Date.UTC(year!, (month ?? 1) - 1, 1))
  );
}

export function formatRelativeDay(iso: string, timeZone: string): string | null {
  const now = new Date();
  const target = new Date(iso);
  const dayKey = (d: Date) =>
    new Intl.DateTimeFormat('en-CA', { timeZone, dateStyle: 'short' }).format(d);
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  if (dayKey(target) === dayKey(now)) return 'Today';
  if (dayKey(target) === dayKey(tomorrow)) return 'Tomorrow';
  return null;
}
