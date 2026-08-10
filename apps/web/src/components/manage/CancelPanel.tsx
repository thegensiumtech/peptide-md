'use client';

import { useState } from 'react';
import type { ManagedBooking } from '@peptide/shared';
import { formatMoney, formatTime } from '@/lib/format';
import { Button } from '@/components/ui/Button';
import { Field, Textarea } from '@/components/ui/Field';
import { cancelBooking, type CancelOutcome } from '@/lib/api/manage';
import { useRequiredSession } from './ManageSession';
import { DateLine, Notice } from './ManagePrimitives';

/**
 * Cancel an appointment.
 *
 * Opening this panel is the deliberate step, so the button below does what it
 * says without a second dialog on top. What it must not do is bury the money:
 * whether this cancellation is refunded is stated before the button, not after
 * it, and it comes from the server's decision rather than a rule repeated here.
 */
export function CancelPanel({
  booking,
  onCancelled,
  onDismiss,
  onExpired,
}: {
  booking: ManagedBooking;
  onCancelled: (outcome: CancelOutcome) => void;
  onDismiss: () => void;
  onExpired: () => void;
}) {
  const { token } = useRequiredSession();
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const paid = booking.amountPaid !== null && booking.amountPaid > 0;

  async function confirm() {
    if (submitting) return;

    setSubmitting(true);
    setError(null);
    const response = await cancelBooking(token, {
      reference: booking.reference,
      reason: reason.trim() || undefined,
    });
    setSubmitting(false);

    if (!response.success) {
      if (response.code === 'SESSION_EXPIRED') return onExpired();
      setError(response.error);
      return;
    }
    onCancelled(response.data);
  }

  return (
    <section
      aria-labelledby="cancel-heading"
      className="rounded-lg border border-danger/25 bg-surface"
    >
      <header className="border-b border-line px-5 py-4 sm:px-6">
        <p className="eyebrow text-danger">Cancel this appointment</p>
        <h2 id="cancel-heading" className="mt-2 text-sm text-ink">
          <DateLine iso={booking.startsAt} timezone={booking.timezone} /> at{' '}
          {formatTime(booking.startsAt, booking.timezone)}
        </h2>
      </header>

      <div className="px-5 py-5 sm:px-6">
        {booking.refundOnCancel ? (
          <Notice tone="signal" title="You will be refunded in full.">
            {paid ? formatMoney(booking.amountPaid!, booking.currency) : 'The full amount'} goes back
            to the card you paid with, usually within five to ten working days. The time returns to
            the doctor’s diary straight away.
          </Notice>
        ) : (
          <Notice tone="amber" title="This cancellation is not automatically refunded.">
            It is inside the {booking.policy.freeCancellationNoticeHours}-hour notice period, so a
            refund is not issued automatically. Cancel anyway if you cannot attend — then contact us,
            and we will look at it.
          </Notice>
        )}

        <Field
          label="Reason (optional)"
          htmlFor="cancel-reason"
          className="mt-6"
          hint="Only the doctor and our team see this. It helps us keep the diary useful."
        >
          <Textarea
            id="cancel-reason"
            value={reason}
            maxLength={500}
            rows={3}
            placeholder="Something came up at work…"
            onChange={(event) => setReason(event.target.value)}
          />
        </Field>

        {error ? (
          <Notice tone="danger" title="We could not cancel it." className="mt-5">
            {error}
          </Notice>
        ) : null}

        <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-line pt-5">
          <Button variant="danger" size="lg" onClick={confirm} disabled={submitting}>
            {submitting ? 'Cancelling…' : `Cancel ${booking.reference}`}
          </Button>
          <Button variant="secondary" size="lg" onClick={onDismiss} disabled={submitting}>
            Keep my appointment
          </Button>
        </div>

        <p className="mt-4 text-micro leading-relaxed text-muted">
          This cannot be undone. You can always book again, but the same time may be gone.
        </p>
      </div>
    </section>
  );
}
