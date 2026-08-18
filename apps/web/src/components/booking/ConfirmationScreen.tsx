'use client';

import Link from 'next/link';
import { formatDate, formatTime, formatWeekday, timezoneAbbreviation, timezoneLabel } from '@/lib/format';
import { ButtonLink } from '@/components/ui/Button';
import { useBooking } from './BookingContext';

/**
 * Terminal screen. It confirms what was booked, says what happens next, and
 * offers the way out — it never loops back into the flow.
 */
export function ConfirmationScreen({
  reminderLeadHours,
  deliveryNote,
}: {
  reminderLeadHours: number;
  deliveryNote: string;
}) {
  const { state } = useBooking();
  const { slot, timezone, bookingReference, patientName, patientEmail } = state;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex items-center gap-3">
        <span aria-hidden className="grid h-6 w-6 place-items-center rounded-full bg-signal">
          <svg viewBox="0 0 12 12" className="h-3 w-3" aria-hidden>
            <path
              d="M2 6.2 4.6 8.8 10 3.4"
              fill="none"
              stroke="white"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <p className="eyebrow text-signal">Confirmed</p>
      </div>

      <h1 className="mt-6 font-display text-h1 font-medium tracking-[-0.02em] text-ink">
        You are in the diary{patientName ? `, ${patientName.split(' ')[0]}` : ''}.
      </h1>
      <p className="mt-5 max-w-xl text-lead leading-relaxed text-ink-soft">
        The doctor has been notified and your confirmation email is on its way, with a calendar
        invite and your joining link attached.
      </p>

      <div className="mt-10 grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-2">
        <div className="bg-surface p-6">
          <p className="eyebrow">Your appointment</p>
          {slot ? (
            <>
              <p className="mt-4 font-display text-h3 font-medium text-ink">
                {formatWeekday(slot.startsAt, timezone)}, {formatDate(slot.startsAt, timezone)}
              </p>
              <p className="mt-3 font-mono text-h2 text-accent">
                {formatTime(slot.startsAt, timezone)} – {formatTime(slot.endsAt, timezone)}
              </p>
              <p className="mt-2 font-mono text-eyebrow uppercase tracking-[0.14em] text-muted">
                {timezoneLabel(timezone)} ({timezoneAbbreviation(timezone, slot.startsAt)})
              </p>
            </>
          ) : null}
        </div>

        <div className="bg-surface p-6">
          {patientEmail ? (
            <p className="mb-5 rounded border border-line bg-surface px-4 py-3 text-micro leading-relaxed text-muted">
              Confirmation and calendar invite sent to{' '}
              <span className="font-mono text-ink">{patientEmail}</span>. Check the spelling — if it
              is wrong, contact us and we will resend it.
            </p>
          ) : null}
          <p className="eyebrow">Reference</p>
          <p className="mt-4 font-mono text-h2 text-ink">{bookingReference ?? 'PMD-4882'}</p>
          <p className="mt-3 text-micro leading-relaxed text-muted">
            Quote this if you need to move or cancel. It is also in your confirmation email.
          </p>
        </div>
      </div>

      <section className="mt-10">
        <h2 className="eyebrow">What happens next</h2>
        <ol className="mt-5 divide-y divide-line border-y border-line">
          {[
            {
              title: 'A confirmation email, now',
              body: 'With the calendar invite and your joining link.',
            },
            {
              title: `A reminder, ${reminderLeadHours} hours before`,
              body: 'Carrying the joining link again, so you do not have to go hunting for it.',
            },
            {
              title: 'The consultation',
              body: deliveryNote,
            },
            {
              title: 'A written summary, within 24 hours',
              body: 'What was discussed and what the doctor advised, in writing.',
            },
          ].map((item) => (
            <li key={item.title} className="flex items-start gap-4 py-4">
              <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-signal" />
              <div>
                <p className="text-base text-ink">{item.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted">{item.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <div className="mt-10 rounded-lg border border-line bg-paper-deep p-6">
        <p className="eyebrow">Need to change it?</p>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted">
          Move or cancel it yourself, any time, using the reference above and the email address you
          booked with. Rescheduling is free, and a cancellation more than 24 hours before the
          appointment is refunded in full.
        </p>
        <ButtonLink
          href={bookingReference ? `/manage/${encodeURIComponent(bookingReference)}` : '/manage'}
          variant="secondary"
          size="md"
          className="mt-5"
        >
          Manage this appointment
        </ButtonLink>
      </div>

      <div className="mt-10 flex flex-wrap items-center gap-4 border-t border-line pt-8">
        <ButtonLink href="/" variant="secondary" size="md">
          Back to the homepage
        </ButtonLink>
        <Link
          href="/contact"
          className="link-cta text-sm text-ink underline decoration-line underline-offset-4 transition-colors hover:decoration-accent"
        >
          Contact us
        </Link>
      </div>
    </div>
  );
}
