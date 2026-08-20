'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ManagedBooking } from '@peptide/shared';
import { formatDateTime, formatMoney } from '@/lib/format';
import { BookingStatusBadge, PaymentStatusBadge } from '@/components/ui/Badge';
import { Button, ButtonLink } from '@/components/ui/Button';
import { DataRow } from '@/components/ui/Card';
import { fetchBooking, type CancelOutcome } from '@/lib/api/manage';
import { useManageSession, useRequiredSession } from './ManageSession';
import { DateLine, DateStamp, LoadingRail, Notice, PolicyNote, TimeRange } from './ManagePrimitives';
import { ReschedulePanel } from './ReschedulePanel';
import { CancelPanel } from './CancelPanel';

type OpenPanel = 'none' | 'reschedule' | 'cancel';

interface Flash {
  tone: 'signal' | 'accent';
  title: string;
  body: string;
}

/**
 * One appointment, and the two things a patient can do to it.
 *
 * Whether either is offered is decided by the API and arrives as flags on the
 * booking. This screen renders the verdict, it does not re-derive it, so a
 * tab left open overnight cannot offer to move an appointment that has since
 * started.
 */
export function ManageBookingScreen({ reference }: { reference: string }) {
  const session = useRequiredSession();
  const { close } = useManageSession();

  const [booking, setBooking] = useState<ManagedBooking | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [panel, setPanel] = useState<OpenPanel>('none');
  const [flash, setFlash] = useState<Flash | null>(null);

  const focusRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const response = await fetchBooking(session.token, reference);
    setLoading(false);

    if (!response.success) {
      if (response.code === 'SESSION_EXPIRED') return close('expired');
      setError(response.error);
      setBooking(null);
      return;
    }
    setBooking(response.data);
  }, [session.token, reference, close]);

  useEffect(() => {
    void load();
  }, [load]);

  // The panels and the outcome notice open below the fold on a phone. Moving to
  // them is the difference between a working screen and one that looks broken.
  useEffect(() => {
    if (panel === 'none' && !flash) return;
    focusRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [panel, flash]);

  if (loading && !booking) return <LoadingRail label="Reading the diary…" />;

  if (error && !booking) {
    return (
      <div className="mx-auto max-w-xl">
        <Notice tone="danger" title="We could not open that appointment.">
          {error}
        </Notice>
        <div className="mt-6 flex flex-wrap gap-3">
          <ButtonLink href="/manage" variant="secondary" size="md">
            All my appointments
          </ButtonLink>
          <Button variant="ghost" size="md" onClick={() => close()}>
            Use a different email
          </Button>
        </div>
      </div>
    );
  }

  if (!booking) return null;

  const showActions = panel === 'none' && (booking.canReschedule || booking.canCancel);

  return (
    <div>
      <Link
        href="/manage"
        className="font-mono text-eyebrow uppercase tracking-[0.14em] text-muted transition-colors hover:text-ink"
      >
        ← All my appointments
      </Link>

      <header className="mt-6 flex flex-wrap items-start gap-x-8 gap-y-6 border-b border-line pb-8">
        <DateStamp
          iso={booking.startsAt}
          timezone={booking.timezone}
          muted={!booking.isUpcoming}
          className="w-20"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <p className="eyebrow">Reference · {booking.reference}</p>
            <BookingStatusBadge status={booking.status} />
          </div>
          <h1 className="mt-4 font-display text-h2 font-medium tracking-[-0.02em] text-ink">
            <DateLine iso={booking.startsAt} timezone={booking.timezone} />
          </h1>
          <div className="mt-4">
            <TimeRange
              startsAt={booking.startsAt}
              endsAt={booking.endsAt}
              timezone={booking.timezone}
              size="lg"
              muted={!booking.isUpcoming}
            />
          </div>
        </div>
      </header>

      {/* Cleared of the sticky site header, which is 4rem tall, scrolling a
          panel to y=0 would put its heading underneath it. */}
      <div ref={focusRef} className="scroll-mt-24" />

      <div aria-live="polite">
        {flash ? (
          <Notice tone={flash.tone} title={flash.title} className="mt-8">
            {flash.body}
          </Notice>
        ) : null}
      </div>

      {panel === 'reschedule' ? (
        <div className="mt-8">
          <ReschedulePanel
            booking={booking}
            onDismiss={() => setPanel('none')}
            onExpired={() => close('expired')}
            onMoved={(updated) => {
              setBooking(updated);
              setPanel('none');
              setFlash({
                tone: 'signal',
                title: 'Your appointment has moved.',
                body: 'A confirmation with an updated calendar invite is on its way. The time you gave up is back in the diary for someone else.',
              });
            }}
          />
        </div>
      ) : null}

      {panel === 'cancel' ? (
        <div className="mt-8">
          <CancelPanel
            booking={booking}
            onDismiss={() => setPanel('none')}
            onExpired={() => close('expired')}
            onCancelled={(outcome: CancelOutcome) => {
              setBooking(outcome.booking);
              setPanel('none');
              setFlash({
                tone: 'signal',
                title: 'Your appointment is cancelled.',
                body: outcome.refunded
                  ? 'You have been refunded in full, it usually reaches your account within five to ten working days. The time is back in the doctor’s diary.'
                  : outcome.refundDue
                    ? 'A full refund is due and our team will process it. The time is back in the doctor’s diary.'
                    : 'A confirmation is on its way. The time is back in the doctor’s diary for someone else.',
              });
            }}
          />
        </div>
      ) : null}

      <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:gap-14">
        <div className="min-w-0">
          {/* A patient needs to see which address their confirmation went
              to, a typo here is the usual reason an email "never arrived". */}
          <h2 className="eyebrow">Your details</h2>
          <dl className="mt-3">
            <DataRow label="Name">{booking.patientName}</DataRow>
            <DataRow label="Email" mono>
              {booking.patientEmail}
            </DataRow>
            <DataRow label="Phone" mono>
              {booking.patientPhone || ', '}
            </DataRow>
          </dl>
          <p className="mt-3 text-micro leading-relaxed text-muted">
            Your confirmation and reminder go to this address. If it is wrong, reply to the
            confirmation email or contact us and we will correct it.
          </p>

          <h2 className="eyebrow">The appointment</h2>
          <dl className="mt-4">
            <DataRow label="Doctor">{booking.doctorName}</DataRow>
            <DataRow label="Length">{booking.durationMinutes} minutes</DataRow>
            <DataRow label="Reference" mono>
              {booking.reference}
            </DataRow>
            <DataRow label="Booked on">
              {formatDateTime(booking.createdAt, booking.timezone)}
            </DataRow>
            <DataRow label="Payment">
              <span className="flex flex-wrap items-center gap-2">
                <PaymentStatusBadge status={booking.paymentStatus} />
                {booking.amountPaid !== null ? (
                  <span className="font-mono">
                    {formatMoney(booking.amountPaid, booking.currency)}
                  </span>
                ) : (
                  <span className="text-muted">Paid through the clinic you booked with</span>
                )}
              </span>
            </DataRow>
            {booking.joiningUrl && booking.isUpcoming ? (
              <DataRow label="Joining link">
                <a
                  href={booking.joiningUrl}
                  className="break-all text-ink underline decoration-line underline-offset-4 hover:decoration-accent"
                >
                  {booking.joiningUrl}
                </a>
              </DataRow>
            ) : null}
            {booking.cancelledAt ? (
              <>
                <DataRow label="Cancelled">
                  {formatDateTime(booking.cancelledAt, booking.timezone)}
                </DataRow>
                {booking.cancellationReason ? (
                  <DataRow label="Reason">{booking.cancellationReason}</DataRow>
                ) : null}
              </>
            ) : null}
          </dl>

          {booking.intake.length > 0 ? (
            <section className="mt-10">
              <h2 className="eyebrow">What you told the doctor</h2>
              <dl className="mt-4">
                {booking.intake.map((answer) => (
                  <DataRow key={answer.question} label={answer.question}>
                    {answer.answer}
                  </DataRow>
                ))}
              </dl>
            </section>
          ) : null}
        </div>

        <aside className="lg:sticky lg:top-8 lg:self-start">
          <div className="rounded-lg border border-line bg-surface p-6">
            <p className="eyebrow">Need to change it?</p>

            {showActions ? (
              <div className="mt-5 grid gap-3">
                {booking.canReschedule ? (
                  <Button size="lg" onClick={() => setPanel('reschedule')}>
                    Move this appointment
                  </Button>
                ) : (
                  <p className="text-micro leading-relaxed text-muted">
                    {booking.rescheduleBlockedReason}
                  </p>
                )}
                {booking.canCancel ? (
                  <Button variant="danger" size="lg" onClick={() => setPanel('cancel')}>
                    Cancel appointment
                  </Button>
                ) : null}
              </div>
            ) : panel === 'none' ? (
              <div className="mt-5 grid gap-4">
                <p className="text-sm leading-relaxed text-ink">
                  {booking.cancelBlockedReason ??
                    booking.rescheduleBlockedReason ??
                    'This appointment can no longer be changed here.'}
                </p>
                <ButtonLink href="/book" size="md">
                  Book a consultation
                </ButtonLink>
              </div>
            ) : (
              <p className="mt-5 text-micro leading-relaxed text-muted">
                Finish or dismiss the step above to come back here.
              </p>
            )}

            <PolicyNote
              freeCancellationNoticeHours={booking.policy.freeCancellationNoticeHours}
              rescheduleCutoffHours={booking.policy.rescheduleCutoffHours}
              className="mt-6 border-t border-line pt-5"
            />
          </div>

          <p className="mt-5 px-1 text-micro leading-relaxed text-muted">
            Anything else, {' '}
            <Link href="/contact" className="text-ink underline underline-offset-2">
              contact us
            </Link>{' '}
            and a person will sort it.
          </p>
        </aside>
      </div>
    </div>
  );
}
