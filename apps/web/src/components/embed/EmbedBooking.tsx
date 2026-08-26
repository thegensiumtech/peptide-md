'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

/**
 * The booking flow as a partner's patient sees it.
 *
 * Three steps and no payment. The scope is explicit that the partner takes the
 * money on their own side, so this books and stops.
 *
 * Nothing here names Peptide MD. The patient is booking with the partner as
 * far as they are concerned, and the scope says plainly that "nothing about
 * the experience tells the patient that another company is involved".
 *
 * Times are shown in the browser's own zone, resolved from Intl rather than
 * asked for. A patient in Sydney should not have to work out what a London
 * time means for them, and asking would be a question they cannot answer.
 */

interface Slot {
  startsAt: string;
  endsAt: string;
}
interface Day {
  date: string;
  slots: Slot[];
}

type Step = 'choosing' | 'details' | 'done';

export function EmbedBooking({
  clientId,
  displayName,
  logoUrl,
  durationMinutes,
  sandbox,
}: {
  clientId: string;
  displayName: string;
  logoUrl: string | null;
  durationMinutes: number;
  sandbox: boolean;
}) {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/London';

  const [step, setStep] = useState<Step>('choosing');
  const [days, setDays] = useState<Day[]>([]);
  const [activeDate, setActiveDate] = useState<string | null>(null);
  const [selected, setSelected] = useState<Slot | null>(null);
  const [hold, setHold] = useState<{ holdToken: string; expiresAt: string } | null>(null);
  const [reference, setReference] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rootRef = useRef<HTMLDivElement>(null);

  /**
   * Tells the host page how tall we are.
   *
   * An iframe has no intrinsic height, so without this the widget is either
   * cut off or floating in dead space. Reported on every size change rather
   * than once, because the flow gets taller at the details step.
   */
  useEffect(() => {
    if (!rootRef.current || typeof ResizeObserver === 'undefined') return;

    const post = (height: number) => {
      window.parent?.postMessage({ type: 'peptide-md:height', clientId, height }, '*');
    };

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) post(Math.ceil(entry.contentRect.height) + 32);
    });

    observer.observe(rootRef.current);
    post(rootRef.current.getBoundingClientRect().height + 32);
    return () => observer.disconnect();
  }, [clientId, step]);

  const loadAvailability = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `${API}/api/embed/${encodeURIComponent(clientId)}/availability?days=14&timezone=${encodeURIComponent(timezone)}`
      );
      const body = await response.json();
      if (!response.ok || !body.success) {
        setError(body.error ?? 'We could not load available times.');
        return;
      }
      const withSlots: Day[] = (body.data.days ?? []).filter((day: Day) => day.slots.length > 0);
      setDays(withSlots);
      setActiveDate(withSlots[0]?.date ?? null);
    } catch {
      setError('We could not reach the booking service. Try again in a moment.');
    } finally {
      setLoading(false);
    }
  }, [clientId, timezone]);

  useEffect(() => {
    void loadAvailability();
  }, [loadAvailability]);

  async function takeSlot(slot: Slot) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`${API}/api/embed/${encodeURIComponent(clientId)}/holds`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startsAt: slot.startsAt }),
      });
      const body = await response.json();

      if (!response.ok || !body.success) {
        // Losing a slot is a normal outcome, not a failure the patient caused.
        // Reload so they are choosing from times that still exist.
        setError(body.error ?? 'That time has just been taken.');
        await loadAvailability();
        return;
      }

      setSelected(slot);
      setHold({ holdToken: body.data.holdToken, expiresAt: body.data.expiresAt });
      setStep('details');
    } catch {
      setError('We could not reach the booking service. Try again in a moment.');
    } finally {
      setBusy(false);
    }
  }

  async function confirm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!hold) return;

    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError(null);

    try {
      const response = await fetch(`${API}/api/embed/${encodeURIComponent(clientId)}/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          holdToken: hold.holdToken,
          name: String(form.get('name') ?? ''),
          email: String(form.get('email') ?? ''),
          phone: String(form.get('phone') ?? ''),
          reason: String(form.get('reason') ?? ''),
          timezone,
          consent: form.get('consent') === 'on',
        }),
      });
      const body = await response.json();

      if (!response.ok || !body.success) {
        setError(body.error ?? 'We could not complete the booking.');
        return;
      }

      setReference(body.data.reference);
      setStep('done');
    } catch {
      setError('We could not reach the booking service. Try again in a moment.');
    } finally {
      setBusy(false);
    }
  }

  const timeLabel = (iso: string) =>
    new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: timezone,
    }).format(new Date(iso));

  const dayLabel = (date: string) =>
    new Intl.DateTimeFormat('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      timeZone: timezone,
    }).format(new Date(`${date}T12:00:00.000Z`));

  const active = days.find((day) => day.date === activeDate);

  return (
    <div ref={rootRef} className="mx-auto w-full max-w-xl text-[15px] leading-relaxed text-slate-900">
      <header className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {logoUrl ? (
            // Not next/image: the URL is partner-supplied and arbitrary, and
            // running it through our optimiser would need every partner's host
            // allowlisted before their widget worked.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" className="h-8 w-auto" />
          ) : null}
          <p className="text-base font-semibold" style={{ color: 'var(--brand)' }}>
            {displayName}
          </p>
        </div>
        {sandbox ? (
          <span className="rounded bg-amber-100 px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-amber-900">
            Sandbox
          </span>
        ) : null}
      </header>

      {error ? (
        <p
          role="alert"
          className="mt-4 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900"
        >
          {error}
        </p>
      ) : null}

      {step === 'choosing' ? (
        <section className="mt-5" aria-label="Choose a time">
          <h2 className="text-lg font-semibold">Book a consultation</h2>
          <p className="mt-1 text-sm text-slate-600">
            {durationMinutes} minutes by video. Times are shown in your own time zone.
          </p>

          {loading ? (
            <p className="mt-6 text-sm text-slate-600">Loading available times…</p>
          ) : days.length === 0 ? (
            <p className="mt-6 text-sm text-slate-600">
              There are no times available at the moment. Please check back shortly.
            </p>
          ) : (
            <>
              <div className="mt-5 flex gap-2 overflow-x-auto pb-2" role="tablist" aria-label="Days">
                {days.map((day) => {
                  const isActive = day.date === activeDate;
                  return (
                    <button
                      key={day.date}
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      onClick={() => setActiveDate(day.date)}
                      className="min-h-11 shrink-0 rounded border px-3 py-2 text-sm transition-colors"
                      style={{
                        borderColor: isActive ? 'var(--brand)' : '#d4d4d8',
                        background: isActive ? 'var(--brand)' : 'transparent',
                        color: isActive ? '#fff' : 'inherit',
                      }}
                    >
                      {dayLabel(day.date)}
                    </button>
                  );
                })}
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
                {active?.slots.map((slot) => (
                  <button
                    key={slot.startsAt}
                    type="button"
                    disabled={busy}
                    onClick={() => takeSlot(slot)}
                    className="min-h-11 rounded border border-slate-300 px-2 py-2 text-sm tabular-nums transition-colors hover:border-slate-900 disabled:opacity-50"
                  >
                    {timeLabel(slot.startsAt)}
                  </button>
                ))}
              </div>
            </>
          )}
        </section>
      ) : null}

      {step === 'details' && selected ? (
        <section className="mt-5" aria-label="Your details">
          <h2 className="text-lg font-semibold">Your details</h2>
          <p className="mt-1 text-sm text-slate-600">
            {dayLabel(selected.startsAt.slice(0, 10))} at {timeLabel(selected.startsAt)}. Held for
            you while you finish.
          </p>

          <form onSubmit={confirm} className="mt-5 grid gap-4">
            <label className="grid gap-1 text-sm">
              <span className="font-medium">Full name</span>
              <input name="name" required className="min-h-11 rounded border border-slate-300 px-3" />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-medium">Email</span>
              <input
                name="email"
                type="email"
                required
                className="min-h-11 rounded border border-slate-300 px-3"
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-medium">Phone</span>
              <input name="phone" required className="min-h-11 rounded border border-slate-300 px-3" />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-medium">
                What would you like to discuss? <span className="text-slate-500">Optional</span>
              </span>
              <textarea name="reason" rows={3} className="rounded border border-slate-300 p-3" />
            </label>

            <label className="flex items-start gap-3 text-sm">
              <input name="consent" type="checkbox" required className="mt-1 h-4 w-4" />
              <span>
                I consent to a private medical consultation and to my answers being held as part of
                my clinical record. I understand this is general medical advice and that no compound
                is supplied, prescribed or dispensed.
              </span>
            </label>

            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={busy}
                className="min-h-11 rounded px-5 text-sm font-medium text-white transition-opacity disabled:opacity-60"
                style={{ background: 'var(--brand-accent)' }}
              >
                {busy ? 'Booking…' : 'Confirm appointment'}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setStep('choosing');
                  setHold(null);
                  setSelected(null);
                  void loadAvailability();
                }}
                className="min-h-11 rounded px-4 text-sm underline underline-offset-4"
              >
                Choose another time
              </button>
            </div>
          </form>
        </section>
      ) : null}

      {step === 'done' && selected ? (
        <section className="mt-5" aria-label="Booked">
          <h2 className="text-lg font-semibold">You are booked in.</h2>
          <p className="mt-2 text-sm text-slate-700">
            {dayLabel(selected.startsAt.slice(0, 10))} at {timeLabel(selected.startsAt)}. A
            confirmation and a calendar invite are on their way to your inbox.
          </p>
          <p className="mt-3 font-mono text-sm">{reference}</p>
        </section>
      ) : null}
    </div>
  );
}
