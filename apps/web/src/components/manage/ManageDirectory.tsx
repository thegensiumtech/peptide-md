'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import type { ManageLookupResult, ManagedBookingSummary } from '@peptide/shared';
import { cn } from '@/lib/cn';
import { formatRelativeDay } from '@/lib/format';
import { BookingStatusBadge } from '@/components/ui/Badge';
import { Button, ButtonLink } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { lookupBookings } from '@/lib/api/manage';
import { useManageSession, useRequiredSession } from './ManageSession';
import { DateLine, DateStamp, LoadingRail, Notice, PolicyNote, TimeRange } from './ManagePrimitives';

/**
 * Everything booked on the verified address, read live from the API.
 *
 * Only ever rendered behind ManageGate, so a session is guaranteed and there is
 * no unauthenticated case to handle here.
 */
export function ManageDirectory() {
  const session = useRequiredSession();
  const { close } = useManageSession();

  const [result, setResult] = useState<ManageLookupResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const response = await lookupBookings(session.token);
    setLoading(false);

    if (!response.success) {
      // A dead token is not an error to read, it sends the patient back to the
      // gate, which explains itself.
      if (response.code === 'SESSION_EXPIRED') return close('expired');
      setError(response.error);
      setResult(null);
      return;
    }
    setResult(response.data);
  }, [session.token, close]);

  // Re-read the diary on every visit rather than showing whatever was here last
  // time, appointments move.
  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-5">
        <p className="min-w-0 text-sm text-muted">
          Showing appointments for <span className="break-all text-ink">{session.email}</span>
        </p>
        <Button variant="ghost" size="sm" onClick={() => close()}>
          Use a different email
        </Button>
      </div>

      {loading ? <LoadingRail label="Reading the diary…" /> : null}

      {error ? (
        <Notice tone="danger" title="We could not load your appointments." className="mt-8">
          {error}{' '}
          <button
            type="button"
            onClick={() => void load()}
            className="text-ink underline underline-offset-2"
          >
            Try again
          </button>
        </Notice>
      ) : null}

      {result && !loading ? <Results result={result} /> : null}
    </div>
  );
}

function Results({ result }: { result: ManageLookupResult }) {
  const nothingAtAll = result.upcoming.length === 0 && result.past.length === 0;

  if (nothingAtAll) {
    return (
      <div className="mt-6 rounded-lg border border-line bg-surface">
        <EmptyState
          title="No appointments under that address"
          description="Nothing is booked with this email. If you booked with a different address, try that one, otherwise the consultation may never have been paid for."
          action={
            <div className="flex flex-wrap justify-center gap-3">
              <ButtonLink href="/book" size="md">
                Book a consultation
              </ButtonLink>
              <ButtonLink href="/contact" variant="secondary" size="md">
                Contact us
              </ButtonLink>
            </div>
          }
        />
      </div>
    );
  }

  return (
    <div className="mt-10 grid gap-12">
      {result.upcoming.length > 0 ? (
        <Section title="Upcoming" count={result.upcoming.length}>
          {result.upcoming.map((booking) => (
            <BookingRow key={booking.reference} booking={booking} />
          ))}
        </Section>
      ) : (
        <Section title="Upcoming" count={0}>
          <div className="py-8">
            <p className="text-sm text-ink">Nothing coming up.</p>
            <p className="mt-1.5 max-w-md text-micro leading-relaxed text-muted">
              Your past consultations are below. Book another whenever you need one.
            </p>
            <ButtonLink href="/book" size="md" className="mt-5">
              Book a consultation
            </ButtonLink>
          </div>
        </Section>
      )}

      {result.past.length > 0 ? (
        <Section title="Earlier" count={result.past.length}>
          {result.past.map((booking) => (
            <BookingRow key={booking.reference} booking={booking} muted />
          ))}
        </Section>
      ) : null}

      <PolicyNote
        freeCancellationNoticeHours={result.policy.freeCancellationNoticeHours}
        rescheduleCutoffHours={result.policy.rescheduleCutoffHours}
        className="border-t border-line pt-6"
      />
    </div>
  );
}

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="flex items-baseline gap-3">
        <h2 className="eyebrow">{title}</h2>
        <span className="font-mono text-eyebrow text-muted">{String(count).padStart(2, '0')}</span>
        <span aria-hidden className="h-px flex-1 bg-line" />
      </div>
      <div className="mt-1">{children}</div>
    </section>
  );
}

/**
 * One appointment as a ledger line. The whole row is the target, a link that
 * only works on a small chevron is a link most people miss on a phone.
 */
function BookingRow({
  booking,
  muted = false,
}: {
  booking: ManagedBookingSummary;
  muted?: boolean;
}) {
  const relative = booking.isUpcoming
    ? formatRelativeDay(booking.startsAt, booking.timezone)
    : null;

  return (
    <Link
      href={`/manage/${encodeURIComponent(booking.reference)}`}
      className={cn(
        'group grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-5 gap-y-4 border-b border-line py-5 transition-colors duration-150',
        'hover:bg-paper-deep/50 sm:grid-cols-[auto_minmax(0,1fr)_auto]'
      )}
    >
      <DateStamp iso={booking.startsAt} timezone={booking.timezone} muted={muted} />

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <p className={cn('text-base', muted ? 'text-ink-soft' : 'text-ink')}>
            <DateLine iso={booking.startsAt} timezone={booking.timezone} />
          </p>
          {relative ? (
            <span className="font-mono text-eyebrow uppercase tracking-[0.14em] text-accent">
              {relative}
            </span>
          ) : null}
        </div>

        <div className="mt-2">
          <TimeRange
            startsAt={booking.startsAt}
            endsAt={booking.endsAt}
            timezone={booking.timezone}
            muted={muted}
          />
        </div>

        <p className="mt-2 text-micro text-muted">
          {booking.doctorName} · <span className="font-mono">{booking.reference}</span>
        </p>
      </div>

      <div className="col-start-2 flex items-center gap-3 sm:col-start-3 sm:justify-end">
        <BookingStatusBadge status={booking.status} />
        <span
          aria-hidden
          className="font-mono text-sm text-muted transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-accent"
        >
          →
        </span>
      </div>
    </Link>
  );
}
