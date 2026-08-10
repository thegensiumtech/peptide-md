'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { cn } from '@/lib/cn';
import { formatDate, formatTime, formatWeekday } from '@/lib/format';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton, SkeletonRegion } from '@/components/ui/Skeleton';

type SlotState = 'free' | 'booked' | 'blocked' | 'held';

interface DiarySlot {
  startsAt: string;
  endsAt: string;
  state: SlotState;
  booking: {
    id: string;
    reference: string;
    patientName: string;
    channel: string;
    partnerName: string | null;
  } | null;
}

interface DiaryDay {
  date: string;
  slots: DiarySlot[];
}

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

/**
 * The doctor's working diary.
 *
 * The availability screen below this one is where the standing pattern is
 * set. This is where the week is actually run: what is booked, what is free,
 * and what he needs to take out because something came up.
 *
 * Blocking is one tap by design. The whole in-house approach depends on him
 * actually marking time as busy — if it took a dialog he would not bother, and
 * a patient would book over his afternoon.
 */
export function DoctorDiary({ doctorId, timezone }: { doctorId: string; timezone: string }) {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [days, setDays] = useState<DiaryDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const from = weekStart.toISOString().slice(0, 10);
      const response = await fetch(`${API}/api/admin/doctor/${doctorId}/diary?from=${from}&days=7`, {
        credentials: 'include',
        cache: 'no-store',
      });
      const body = await response.json();
      if (!response.ok || !body.success) throw new Error(body.error ?? 'Could not load the diary.');
      setDays(body.data.days);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load the diary.');
    } finally {
      setLoading(false);
    }
  }, [doctorId, weekStart]);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggle(slot: DiarySlot) {
    if (slot.state === 'booked' || slot.state === 'held') return;
    setPending(slot.startsAt);
    setNotice(null);

    try {
      const response = await fetch(`${API}/api/admin/doctor/${doctorId}/slots/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ startsAt: slot.startsAt, endsAt: slot.endsAt }),
      });
      const body = await response.json();

      if (!response.ok || !body.success) {
        setNotice(body.error ?? 'That change could not be saved.');
        return;
      }

      // Update in place so the grid does not jump under the cursor.
      setDays((current) =>
        current.map((day) => ({
          ...day,
          slots: day.slots.map((s) =>
            s.startsAt === slot.startsAt ? { ...s, state: body.data.blocked ? 'blocked' : 'free' } : s
          ),
        }))
      );
    } catch {
      setNotice('We could not reach the server. Try again.');
    } finally {
      setPending(null);
    }
  }

  const shift = (weeks: number) => {
    const next = new Date(weekStart);
    next.setUTCDate(next.getUTCDate() + weeks * 7);
    setWeekStart(next);
  };

  const totals = days.reduce(
    (acc, day) => {
      for (const slot of day.slots) acc[slot.state] = (acc[slot.state] ?? 0) + 1;
      return acc;
    },
    {} as Record<SlotState, number>
  );

  return (
    <Card>
      <CardHeader
        title="Your week"
        description={`Times in ${timezone.split('/')[1]?.replace('_', ' ') ?? timezone}. Tap a free slot to take it out of the diary.`}
        action={
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => shift(-1)}>
              ← Previous
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setWeekStart(startOfWeek(new Date()))}>
              This week
            </Button>
            <Button variant="secondary" size="sm" onClick={() => shift(1)}>
              Next →
            </Button>
          </div>
        }
      />

      <CardBody>
        <div className="flex flex-wrap items-center gap-4">
          <Legend swatch="border-line bg-surface" label={`Free (${totals.free ?? 0})`} />
          <Legend swatch="border-signal/30 bg-signal-tint" label={`Booked (${totals.booked ?? 0})`} />
          <Legend swatch="border-line bg-paper-deep" label={`Blocked (${totals.blocked ?? 0})`} />
        </div>

        {notice ? (
          <p
            role="alert"
            className="mt-4 rounded border border-danger/25 bg-danger-tint px-4 py-3 text-micro leading-relaxed text-danger"
          >
            {notice}
          </p>
        ) : null}

        {error ? (
          <div className="mt-6">
            <EmptyState
              title="The diary could not be loaded"
              description={error}
              action={
                <Button size="sm" onClick={() => void load()}>
                  Try again
                </Button>
              }
            />
          </div>
        ) : loading ? (
          <SkeletonRegion label="Loading your week" className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 5 }, (_, index) => (
              <div key={index} className="rounded-lg border border-line">
                <div className="border-b border-line px-4 py-2.5">
                  <Skeleton className="h-3.5 w-20" />
                  <Skeleton className="mt-1.5 h-2.5 w-24" />
                </div>
                <div className="grid grid-cols-3 gap-1.5 p-3">
                  {Array.from({ length: 9 }, (_, slot) => (
                    <Skeleton key={slot} className="h-8" />
                  ))}
                </div>
              </div>
            ))}
          </SkeletonRegion>
        ) : days.length === 0 ? (
          <div className="mt-6">
            <EmptyState
              title="Nothing scheduled this week"
              description="Your weekly pattern does not offer any sessions in this week. Add one below, or move to another week."
            />
          </div>
        ) : (
          <div className="mt-6 grid animate-fade-up gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {days.map((day) => (
              <div key={day.date} className="rounded-lg border border-line">
                <div className="border-b border-line px-4 py-2.5">
                  <p className="text-sm font-medium text-ink">
                    {formatWeekday(`${day.date}T12:00:00.000Z`, timezone)}
                  </p>
                  <p className="mt-0.5 font-mono text-eyebrow uppercase tracking-[0.12em] text-muted">
                    {formatDate(`${day.date}T12:00:00.000Z`, timezone)}
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-1.5 p-3">
                  {day.slots.map((slot) => {
                    const isBooked = slot.state === 'booked';
                    const isHeld = slot.state === 'held';
                    const isBlocked = slot.state === 'blocked';
                    const busy = pending === slot.startsAt;

                    const label = isBooked
                      ? `Booked — ${slot.booking?.patientName}`
                      : isHeld
                        ? 'Being booked right now'
                        : isBlocked
                          ? 'Blocked. Tap to free it.'
                          : 'Free. Tap to block it.';

                    const content = (
                      <>
                        {formatTime(slot.startsAt, timezone)}
                        {isBlocked ? <span className="sr-only"> (blocked)</span> : null}
                      </>
                    );

                    const classes = cn(
                      'rounded border py-2 text-center font-mono text-micro transition-all duration-150',
                      busy && 'opacity-50',
                      isBooked && 'border-signal/30 bg-signal-tint text-signal',
                      isHeld && 'border-amber/30 bg-amber-tint text-amber',
                      isBlocked && 'border-line bg-paper-deep text-muted line-through',
                      slot.state === 'free' &&
                        'border-line bg-surface text-ink hover:border-danger/40 hover:bg-danger-tint'
                    );

                    // A booked slot links to the appointment rather than
                    // pretending to be a control the doctor can press.
                    return isBooked && slot.booking ? (
                      <Link
                        key={slot.startsAt}
                        href={`/admin/bookings/${slot.booking.id}`}
                        title={label}
                        className={classes}
                      >
                        {content}
                      </Link>
                    ) : (
                      <button
                        key={slot.startsAt}
                        type="button"
                        onClick={() => void toggle(slot)}
                        disabled={isHeld || busy}
                        aria-pressed={isBlocked}
                        title={label}
                        aria-label={`${formatTime(slot.startsAt, timezone)} — ${label}`}
                        className={classes}
                      >
                        {content}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="mt-6 max-w-2xl text-micro leading-relaxed text-muted">
          Blocking a slot removes it from this website and from every partner site at the same
          moment. A slot with a patient already booked cannot be blocked — cancel the appointment
          first, so the patient is told.
        </p>
      </CardBody>
    </Card>
  );
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <span className="flex items-center gap-2">
      <span aria-hidden className={cn('h-3 w-4 rounded-sm border', swatch)} />
      <span className="text-micro text-muted">{label}</span>
    </span>
  );
}

/** Monday of the week containing the given date, in UTC. */
function startOfWeek(date: Date): Date {
  const result = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const offset = (result.getUTCDay() + 6) % 7;
  result.setUTCDate(result.getUTCDate() - offset);
  return result;
}
