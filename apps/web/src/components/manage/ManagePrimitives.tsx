import { cn } from '@/lib/cn';
import { formatDate, formatTime, formatWeekday, timezoneAbbreviation, timezoneLabel } from '@/lib/format';

/**
 * The date stamp.
 *
 * A consultation is a fixed point in a diary, so it is drawn as one — a torn
 * calendar chit rather than a line of text. It is the anchor of every row in
 * the list and of the appointment header, which is what makes a page of
 * appointments scannable by date alone.
 */
export function DateStamp({
  iso,
  timezone,
  muted = false,
  className,
}: {
  iso: string;
  timezone: string;
  muted?: boolean;
  className?: string;
}) {
  const day = new Intl.DateTimeFormat('en-GB', { day: 'numeric', timeZone: timezone }).format(
    new Date(iso)
  );
  const month = new Intl.DateTimeFormat('en-GB', { month: 'short', timeZone: timezone })
    .format(new Date(iso))
    .toUpperCase();

  return (
    <div
      className={cn(
        'grid w-16 shrink-0 place-items-center rounded border px-2 py-2.5 text-center',
        muted ? 'border-line bg-paper-deep' : 'border-amber/30 bg-amber-tint',
        className
      )}
    >
      <span className="font-mono text-eyebrow uppercase tracking-[0.14em] text-muted">
        {formatWeekday(iso, timezone).slice(0, 3)}
      </span>
      <span
        className={cn(
          'font-display text-h3 font-medium leading-none',
          muted ? 'text-ink-soft' : 'text-ink'
        )}
      >
        {day}
      </span>
      <span className="font-mono text-eyebrow uppercase tracking-[0.14em] text-muted">{month}</span>
    </div>
  );
}

/** The time range, with the zone spelled out. Never a bare number. */
export function TimeRange({
  startsAt,
  endsAt,
  timezone,
  size = 'md',
  muted = false,
}: {
  startsAt: string;
  endsAt: string;
  timezone: string;
  size?: 'md' | 'lg';
  muted?: boolean;
}) {
  return (
    <div className="min-w-0">
      <p
        className={cn(
          'font-mono',
          size === 'lg' ? 'text-h2' : 'text-h3',
          muted ? 'text-ink-soft' : 'text-amber'
        )}
      >
        {formatTime(startsAt, timezone)} – {formatTime(endsAt, timezone)}
      </p>
      <p className="mt-1 font-mono text-eyebrow uppercase tracking-[0.14em] text-muted">
        {timezoneLabel(timezone)} ({timezoneAbbreviation(timezone, startsAt)})
      </p>
    </div>
  );
}

/** Full date line, e.g. 'Thursday, 13 Aug 2026'. */
export function DateLine({ iso, timezone }: { iso: string; timezone: string }) {
  return (
    <>
      {formatWeekday(iso, timezone)}, {formatDate(iso, timezone)}
    </>
  );
}

type NoticeTone = 'danger' | 'signal' | 'amber' | 'neutral';

const NOTICE_TONES: Record<NoticeTone, string> = {
  danger: 'border-danger/25 bg-danger-tint',
  signal: 'border-signal/25 bg-signal-tint',
  amber: 'border-amber/25 bg-amber-tint',
  neutral: 'border-line bg-paper-deep',
};

const NOTICE_TITLES: Record<NoticeTone, string> = {
  danger: 'text-danger',
  signal: 'text-signal',
  amber: 'text-amber',
  neutral: 'text-ink',
};

/**
 * Inline message. Errors take role="alert" so a screen reader announces a
 * failed cancellation the moment it happens rather than when focus wanders
 * back over it.
 */
export function Notice({
  tone = 'neutral',
  title,
  children,
  className,
}: {
  tone?: NoticeTone;
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      role={tone === 'danger' ? 'alert' : undefined}
      className={cn('rounded-lg border px-5 py-4', NOTICE_TONES[tone], className)}
    >
      {title ? (
        <p className={cn('text-sm font-semibold', NOTICE_TITLES[tone])}>{title}</p>
      ) : null}
      <div className={cn('text-micro leading-relaxed text-ink', title && 'mt-1.5')}>{children}</div>
    </div>
  );
}

/** Every wait in these screens looks the same, and every one is announced. */
export function LoadingRail({ label }: { label: string }) {
  return (
    <div className="grid place-items-center py-16" role="status" aria-live="polite">
      <p className="font-mono text-eyebrow uppercase tracking-[0.16em] text-muted">{label}</p>
    </div>
  );
}

/** The terms, quoted from the same numbers the server decided against. */
export function PolicyNote({
  freeCancellationNoticeHours,
  rescheduleCutoffHours,
  className,
}: {
  freeCancellationNoticeHours: number;
  rescheduleCutoffHours: number;
  className?: string;
}) {
  return (
    <p className={cn('text-micro leading-relaxed text-muted', className)}>
      Moving an appointment is free up to {rescheduleCutoffHours} hours beforehand. Cancelling with
      more than {freeCancellationNoticeHours} hours’ notice is refunded in full.
    </p>
  );
}
