'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ManageAvailability, ManagedBooking } from '@peptide/shared';
import { cn } from '@/lib/cn';
import { formatDate, formatTime, formatWeekday, timezoneAbbreviation, timezoneLabel } from '@/lib/format';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Field';
import { fetchRescheduleSlots, rescheduleBooking } from '@/lib/api/manage';
import { useRequiredSession } from './ManageSession';
import { DateLine, Notice } from './ManagePrimitives';

/**
 * Time zones offered explicitly. The zone the patient booked in is preselected,
 * but it stays changeable, someone who has since moved should not have to do
 * the arithmetic to recognise their own appointment.
 */
const BASE_ZONES = [
  'Europe/London',
  'Australia/Sydney',
  'Australia/Melbourne',
  'Australia/Brisbane',
  'Australia/Perth',
  'Europe/Dublin',
  'America/New_York',
];

/**
 * Move an appointment.
 *
 * Reads the diary live rather than trusting anything cached: by the time a
 * patient opens this, the times they were offered on the booking screen days
 * ago are long out of date. If the slot goes while they are deciding, the API
 * says so and the list reloads underneath them.
 */
export function ReschedulePanel({
  booking,
  onMoved,
  onDismiss,
  onExpired,
}: {
  booking: ManagedBooking;
  onMoved: (updated: ManagedBooking) => void;
  onDismiss: () => void;
  onExpired: () => void;
}) {
  const { token } = useRequiredSession();
  const [availability, setAvailability] = useState<ManageAvailability | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [timezone, setTimezone] = useState(booking.timezone);
  const [activeDate, setActiveDate] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    let live = true;

    async function load() {
      setLoading(true);
      const response = await fetchRescheduleSlots(token, booking.reference);
      if (!live) return;

      setLoading(false);
      if (!response.success) {
        if (response.code === 'SESSION_EXPIRED') return onExpired();
        setError(response.error);
        return;
      }
      setAvailability(response.data);
      setActiveDate(response.data.days[0]?.date ?? null);
    }

    void load();
    return () => {
      live = false;
    };
  }, [booking.reference, token, onExpired]);

  const zones = useMemo(
    () => (BASE_ZONES.includes(timezone) ? BASE_ZONES : [timezone, ...BASE_ZONES]),
    [timezone]
  );

  const days = availability?.days ?? [];
  const activeDay = days.find((day) => day.date === activeDate) ?? days[0];
  const selectedSlot = activeDay?.slots.find((slot) => slot.startsAt === selected) ?? null;

  async function confirm() {
    if (!selectedSlot || submitting) return;

    setSubmitting(true);
    setError(null);
    const response = await rescheduleBooking(token, {
      reference: booking.reference,
      startsAt: selectedSlot.startsAt,
      timezone,
    });
    setSubmitting(false);

    if (!response.success) {
      if (response.code === 'SESSION_EXPIRED') return onExpired();
      setError(response.error);
      // Someone reached that time first. Re-read the diary so the patient is
      // choosing from what is actually left, not from what was there a minute ago.
      if (response.code === 'SLOT_TAKEN' || response.code === 'SLOT_UNAVAILABLE') {
        setSelected(null);
        const refreshed = await fetchRescheduleSlots(token, booking.reference);
        if (refreshed.success) setAvailability(refreshed.data);
      }
      return;
    }

    onMoved(response.data);
  }

  return (
    <section
      aria-labelledby="reschedule-heading"
      className="rounded-lg border border-line bg-surface"
    >
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4 sm:px-6">
        <div>
          <p className="eyebrow">Move this appointment</p>
          <h2 id="reschedule-heading" className="mt-2 text-sm text-ink">
            Currently{' '}
            <span className="text-muted">
              <DateLine iso={booking.startsAt} timezone={booking.timezone} /> at{' '}
              {formatTime(booking.startsAt, booking.timezone)}
            </span>
          </h2>
        </div>
        <Button variant="ghost" size="sm" onClick={onDismiss}>
          Keep current time
        </Button>
      </header>

      <div className="px-5 py-5 sm:px-6">
        {loading ? (
          <p
            className="py-8 text-center font-mono text-eyebrow uppercase tracking-[0.16em] text-muted"
            role="status"
          >
            Reading the doctor’s diary…
          </p>
        ) : null}

        {error ? (
          <Notice tone="danger" title="That did not work." className="mb-6">
            {error}
          </Notice>
        ) : null}

        {!loading && days.length === 0 ? (
          <p className="py-6 text-sm leading-relaxed text-muted">
            There is nothing free in the next three weeks. Contact us and we will find you a time
            directly.
          </p>
        ) : null}

        {!loading && activeDay ? (
          <>
            <div className="flex flex-wrap items-end gap-4 rounded border border-line bg-paper-deep px-4 py-3">
              <div className="grid gap-1.5">
                <label htmlFor="reschedule-timezone" className="text-micro font-medium text-ink-soft">
                  Show times in
                </label>
                <Select
                  id="reschedule-timezone"
                  value={timezone}
                  onChange={(event) => setTimezone(event.target.value)}
                  className="min-w-56 bg-surface"
                >
                  {zones.map((zone) => (
                    <option key={zone} value={zone}>
                      {timezoneLabel(zone)} ({timezoneAbbreviation(zone, activeDay.slots[0]?.startsAt)})
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="mt-6">
              <h3 className="eyebrow">Day</h3>
              <div className="mt-3 flex gap-2 overflow-x-auto pb-2">
                {days.map((day) => {
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

            <div className="mt-6">
              <h3 className="eyebrow">
                Times on {formatWeekday(`${activeDay.date}T12:00:00.000Z`, timezone)}
              </h3>
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
            </div>

            <div className="mt-7 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-5">
              <p className="text-micro leading-relaxed text-muted">
                {selectedSlot ? (
                  <>
                    Moving to{' '}
                    <span className="text-ink">
                      <DateLine iso={selectedSlot.startsAt} timezone={timezone} />
                    </span>{' '}
                    at{' '}
                    <span className="font-mono text-accent">
                      {formatTime(selectedSlot.startsAt, timezone)}
                    </span>
                    .
                  </>
                ) : (
                  'Choose a new time. Nothing changes until you confirm.'
                )}
              </p>
              <Button size="lg" onClick={confirm} disabled={!selectedSlot || submitting}>
                {submitting ? 'Moving…' : 'Confirm new time'}
              </Button>
            </div>
          </>
        ) : null}
      </div>
    </section>
  );
}
