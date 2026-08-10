'use client';

import { useState } from 'react';
import type { BookingStatus } from '@peptide/shared';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Field, Textarea } from '@/components/ui/Field';

type Pending = 'cancel' | 'reschedule' | null;

/**
 * Cancel and reschedule.
 *
 * Both are destructive enough to confirm rather than fire on one click — a
 * cancellation releases the slot back into the shared calendar and triggers
 * the patient and doctor emails. The doctor role sees the state but cannot act.
 */
export function BookingActions({
  reference,
  status,
  canManage,
}: {
  reference: string;
  status: BookingStatus;
  canManage: boolean;
}) {
  const [pending, setPending] = useState<Pending>(null);
  const [done, setDone] = useState<string | null>(null);

  const isClosed = status === 'cancelled' || status === 'completed' || status === 'no_show';

  if (!canManage) {
    return (
      <Card>
        <CardHeader title="Managing this booking" />
        <CardBody>
          <p className="text-micro leading-relaxed text-muted">
            Cancellations and reschedules are handled by the Peptides MD team. Ask an administrator
            if this appointment needs to move.
          </p>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader title="Actions" description={`Booking ${reference}`} />
      <CardBody>
        {done ? (
          <p
            role="status"
            className="rounded border border-signal/25 bg-signal-tint px-4 py-3 text-micro leading-relaxed text-ink"
          >
            {done}
          </p>
        ) : null}

        {isClosed ? (
          <p className="text-micro leading-relaxed text-muted">
            This booking is closed. Nothing further can be changed on it.
          </p>
        ) : pending === 'cancel' ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              setPending(null);
              setDone('Cancelled. The slot is back in the calendar and both emails have gone out.');
            }}
            className="grid gap-4"
          >
            <p className="text-sm leading-relaxed text-ink">
              Cancelling releases the time back into the shared calendar and emails both the patient
              and the doctor.
            </p>
            <Field
              label="Reason"
              htmlFor="reason"
              hint="Included in the patient’s email and kept on the record."
            >
              <Textarea id="reason" name="reason" rows={3} required />
            </Field>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" variant="danger" size="sm">
                Confirm cancellation
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setPending(null)}>
                Keep the booking
              </Button>
            </div>
          </form>
        ) : pending === 'reschedule' ? (
          <div className="grid gap-4">
            <p className="text-sm leading-relaxed text-ink">
              Rescheduling opens the doctor’s live availability and moves the appointment, keeping
              the same reference and payment.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                onClick={() => {
                  setPending(null);
                  setDone('Reschedule started. Pick the new time from the doctor’s availability.');
                }}
              >
                Choose a new time
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setPending(null)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={() => setPending('reschedule')}>
              Reschedule
            </Button>
            <Button variant="danger" size="sm" onClick={() => setPending('cancel')}>
              Cancel booking
            </Button>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
