'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/cn';
import {
  formatDate,
  formatTime,
  formatWeekday,
  timezoneAbbreviation,
  timezoneLabel,
} from '@/lib/format';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Field';
import { Skeleton, SkeletonRegion, SkeletonSlots } from '@/components/ui/Skeleton';
import {
  getAvailability,
  holdSlot,
  verifyPayment,
  type AvailabilityPayload,
} from '@/lib/api/booking';
import { useBooking } from './BookingContext';

/**
 * Time zones offered explicitly. The patient's own zone is detected and
 * pre-selected, but it stays changeable — someone booking from a hotel in a
 * third country should not have to do the arithmetic.
 */
const BASE_ZONES = [
  'Europe/London',
  'Australia/Sydney',
  'Australia/Melbourne',
  'Australia/Brisbane',
  'Australia/Perth',
  'Europe/Dublin',
  'America/New_York',
] as const;

type Phase = 'verifying' | 'ready' | 'unpaid' | 'error';

export function SlotPicker() {
  const { state, update } = useBooking();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [phase, setPhase] = useState<Phase>('verifying');
  const [message, setMessage] = useState<string | null>(null);
  const [availability, setAvailability] = useState<AvailabilityPayload | null>(null);
  const [timezone, setTimezone] = useState(state.timezone);
  const [detectedZone, setDetectedZone] = useState<string | null>(null);
  const [activeDate, setActiveDate] = useState<string>('');
  const [selected, setSelected] = useState<string | null>(state.slot?.startsAt ?? null);
  const [holding, setHolding] = useState(false);
  const [holdError, setHoldError] = useState<string | null>(null);

  // Stripe hands the patient back with these on the URL.
  const returnedBookingId = searchParams.get('booking');
  const returnedSessionId = searchParams.get('session');

  useEffect(() => {
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!detected) return;
    setDetectedZone(detected);
    setTimezone((current) => (current === 'Europe/London' ? detected : current));
  }, []);

  const zones = useMemo(
    () =>
      detectedZone && !BASE_ZONES.includes(detectedZone as (typeof BASE_ZONES)[number])
        ? [detectedZone, ...BASE_ZONES]
        : [...BASE_ZONES],
    [detectedZone]
  );

  const loadAvailability = useCallback(async () => {
    const result = await getAvailability(21);
    if (!result.success) {
      setPhase('error');
      setMessage(result.error);
      return;
    }
    setAvailability(result.data);
    setActiveDate((current) => current || (result.data.days[0]?.date ?? ''));
    setPhase('ready');
  }, []);

  /**
   * Confirm the payment before showing any calendar.
   *
   * The webhook is the primary path, but the patient usually gets back here
   * first. The server asks Stripe directly what that session's status is — the
   * browser only supplies the id, it never asserts the outcome.
   */
  useEffect(() => {
    let cancelled = false;

    async function settle() {
      const bookingId = returnedBookingId ?? state.bookingId;

      if (!bookingId) {
        if (!cancelled) {
          setPhase('unpaid');
          setMessage(
            'We could not find your booking. Start again — nothing will be charged twice.'
          );
        }
        return;
      }

      if (returnedSessionId) {
        const result = await verifyPayment(bookingId, returnedSessionId);
        if (cancelled) return;

        if (!result.success) {
          setPhase('error');
          setMessage(result.error);
          return;
        }

        if (result.data.paymentStatus !== 'paid') {
          setPhase('unpaid');
          setMessage(
            'That payment has not completed. Nothing has been charged and no time is held.'
          );
          return;
        }

        update({ bookingId, paid: true });
        // Drop the Stripe parameters so a refresh does not re-verify.
        router.replace('/book/slot');
        await loadAvailability();
        return;
      }

      if (state.paid) {
        await loadAvailability();
        return;
      }

      if (!cancelled) {
        setPhase('unpaid');
        setMessage('This booking has not been paid for yet.');
      }
    }

    void settle();
    return () => {
      cancelled = true;
    };
    // Deliberately keyed on the identifiers only: adding the callbacks would
    // re-verify the payment on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [returnedBookingId, returnedSessionId, state.bookingId, state.paid]);

  const activeDay = useMemo(
    () => availability?.days.find((day) => day.date === activeDate) ?? availability?.days[0],
    [availability, activeDate]
  );

  const selectedSlot = useMemo(
    () => activeDay?.slots.find((slot) => slot.startsAt === selected) ?? null,
    [activeDay, selected]
  );

  async function confirm() {
    if (!selectedSlot || !state.bookingId) return;
    setHoldError(null);
    setHolding(true);

    const result = await holdSlot(state.bookingId, selectedSlot.startsAt, timezone);

    if (!result.success) {
      setHolding(false);
      setHoldError(result.error);
      // Someone took it while this patient was deciding — refresh so the grid
      // reflects reality rather than leaving a dead button.
      if (result.code === 'SLOT_TAKEN') {
        setSelected(null);
        await loadAvailability();
      }
      return;
    }

    update({
      slot: { startsAt: result.data.startsAt, endsAt: result.data.endsAt },
      holdToken: result.data.holdToken,
      holdExpiresAt: result.data.expiresAt,
      timezone,
    });
    router.push('/book/intake');
  }

  // --- Non-ready states ------------------------------------------------------

  if (phase === 'verifying') {
    return (
      <SkeletonRegion label="Confirming your payment" className="grid gap-12 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:gap-16">
        <div>
          <Skeleton className="h-2.5 w-40" />
          <Skeleton className="mt-5 h-12 w-4/5" />
          <Skeleton className="mt-6 h-4 w-full max-w-xl" />
          <Skeleton className="mt-8 h-20 w-full rounded-lg" />
          <Skeleton className="mt-8 h-2.5 w-12" />
          <div className="mt-3 flex gap-2">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-20 w-24 shrink-0" />
            ))}
          </div>
          <div className="mt-8">
            <SkeletonSlots count={12} />
          </div>
        </div>
        <Skeleton className="h-64 rounded-lg" />
      </SkeletonRegion>
    );
  }

  if (phase === 'unpaid' || phase === 'error') {
    return (
      <div className="mx-auto max-w-lg text-center">
        <h1 className="font-display text-h1 font-medium text-ink">
          {phase === 'unpaid' ? 'We could not confirm your payment.' : 'Something went wrong.'}
        </h1>
        <p className="mt-4 text-lead leading-relaxed text-muted">{message}</p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <Button onClick={() => router.push('/book/payment')} size="md">
            Back to payment
          </Button>
          <Link
            href="/contact"
            className="link-cta text-sm text-ink underline decoration-line underline-offset-4"
          >
            Contact us
          </Link>
        </div>
      </div>
    );
  }

  if (!availability || !activeDay || availability.days.length === 0) {
    return (
      <div className="mx-auto max-w-lg text-center">
        <h1 className="font-display text-h1 font-medium text-ink">No times are open.</h1>
        <p className="mt-4 text-lead text-muted">
          The doctor’s diary has nothing free in the next three weeks. You have paid, so do not pay
          again — contact us and we will find you a time.
        </p>
        <Link
          href="/contact"
          className="mt-6 inline-block text-sm text-ink underline underline-offset-4"
        >
          Contact us
        </Link>
      </div>
    );
  }

  // --- The picker ------------------------------------------------------------

  return (
    <div className="grid animate-fade-up gap-12 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:gap-16">
      <div>
        <p className="eyebrow">Step three · Choose a time</p>
        <h1 className="mt-5 font-display text-h1 font-medium tracking-[-0.02em] text-ink">
          When would you like to talk?
        </h1>
        <p className="mt-6 max-w-xl text-lead leading-relaxed text-ink-soft">
          These are the doctor’s genuinely free times. Pick one and it is held for you while you
          finish.
        </p>

        {/* Time zone first — it changes every number on this screen. */}
        <div className="mt-8 flex flex-wrap items-end gap-4 rounded-lg border border-line bg-surface p-4">
          <div className="grid gap-1.5">
            <label htmlFor="timezone" className="text-micro font-medium text-ink-soft">
              Show times in
            </label>
            <Select
              id="timezone"
              value={timezone}
              onChange={(event) => setTimezone(event.target.value)}
              className="min-w-56"
            >
              {zones.map((zone) => (
                <option key={zone} value={zone}>
                  {timezoneLabel(zone)} ({timezoneAbbreviation(zone, activeDay.slots[0]?.startsAt)})
                </option>
              ))}
            </Select>
          </div>
          <p className="pb-2 text-micro text-muted">
            Every time below is in {timezoneLabel(timezone)}.
          </p>
        </div>

        <div className="mt-8">
          <h2 className="eyebrow">Day</h2>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-2">
            {availability.days.map((day) => {
              const isActive = day.date === activeDay.date;
              return (
                <button
                  key={day.date}
                  type="button"
                  onClick={() => {
                    setActiveDate(day.date);
                    setSelected(null);
                  }}
                  aria-pressed={isActive}
                  className={cn(
                    'shrink-0 rounded border px-4 py-3 text-left transition-colors duration-150',
                    isActive
                      ? 'border-accent bg-accent-tint'
                      : 'border-line bg-surface hover:border-ink/25'
                  )}
                >
                  <span className="block font-mono text-eyebrow uppercase tracking-[0.14em] text-muted">
                    {formatWeekday(`${day.date}T12:00:00.000Z`, timezone).slice(0, 3)}
                  </span>
                  <span className="mt-1 block text-sm font-medium text-ink">
                    {formatDate(`${day.date}T12:00:00.000Z`, timezone).replace(/ \d{4}$/, '')}
                  </span>
                  <span className="mt-0.5 block font-mono text-eyebrow text-muted">
                    {day.slots.length} open
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-8">
          <h2 className="eyebrow">
            Times on {formatWeekday(`${activeDay.date}T12:00:00.000Z`, timezone)}
          </h2>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {activeDay.slots.map((slot) => {
              const isSelected = slot.startsAt === selected;
              return (
                <button
                  key={slot.startsAt}
                  type="button"
                  onClick={() => setSelected(slot.startsAt)}
                  aria-pressed={isSelected}
                  className={cn(
                    'rounded border py-3 font-mono text-sm transition-all duration-150',
                    isSelected
                      ? 'border-accent bg-accent text-white shadow-raise'
                      : 'border-line bg-surface text-ink hover:border-accent hover:bg-accent-tint'
                  )}
                >
                  {formatTime(slot.startsAt, timezone)}
                </button>
              );
            })}
          </div>
          <p className="mt-4 font-mono text-eyebrow uppercase tracking-[0.14em] text-muted">
            Only free times are shown
          </p>
        </div>
      </div>

      <aside className="lg:sticky lg:top-8 lg:self-start">
        <div className="rounded-lg border border-line bg-surface p-6">
          <p className="eyebrow">Your appointment</p>
          {selectedSlot ? (
            <>
              <p className="mt-4 font-display text-h3 font-medium text-ink">
                {formatWeekday(selectedSlot.startsAt, timezone)}
              </p>
              <p className="mt-1 text-base text-ink-soft">
                {formatDate(selectedSlot.startsAt, timezone)}
              </p>
              <p className="mt-4 font-mono text-h3 text-accent">
                {formatTime(selectedSlot.startsAt, timezone)} –{' '}
                {formatTime(selectedSlot.endsAt, timezone)}
              </p>
              <p className="mt-1 font-mono text-eyebrow uppercase tracking-[0.14em] text-muted">
                {timezoneLabel(timezone)} ({timezoneAbbreviation(timezone, selectedSlot.startsAt)})
              </p>

              {holdError ? (
                <p
                  role="alert"
                  className="mt-4 rounded border border-danger/25 bg-danger-tint px-3 py-2 text-micro leading-relaxed text-danger"
                >
                  {holdError}
                </p>
              ) : null}

              <Button size="lg" className="mt-6 w-full" onClick={confirm} disabled={holding}>
                {holding ? 'Holding it for you…' : 'Hold this time'}
              </Button>
              <p className="mt-3 text-center text-micro leading-relaxed text-muted">
                Held for you while you finish the next step.
              </p>
            </>
          ) : (
            <p className="mt-4 text-sm leading-relaxed text-muted">
              Choose a day and a time and it will appear here.
            </p>
          )}
        </div>

        {/* Payment is done. There is no route backwards from here. */}
        <div className="mt-6 rounded-lg border border-signal/25 bg-signal-tint p-5">
          <p className="eyebrow text-signal">Payment received</p>
          <p className="mt-3 text-micro leading-relaxed text-ink">
            Your consultation is paid for
            {state.bookingReference ? ` — reference ${state.bookingReference}` : ''}. If you cannot
            find a time that works, do not pay again —{' '}
            <Link href="/contact" className="underline underline-offset-2">
              contact us
            </Link>{' '}
            and we will book you in directly.
          </p>
        </div>
      </aside>
    </div>
  );
}
