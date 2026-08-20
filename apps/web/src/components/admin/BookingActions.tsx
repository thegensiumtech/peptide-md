'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { BookingStatus } from '@peptide/shared';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Field, Textarea, Checkbox } from '@/components/ui/Field';
import { formatMoney } from '@/lib/format';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

type Pending = 'cancel' | 'decline' | null;
export type RefundState = 'none' | 'pending' | 'approved' | 'declined' | 'failed';

/**
 * Cancel, reschedule, and decide refunds.
 *
 * Cancelling and refunding are deliberately two decisions. Cancelling releases
 * the appointment at once, because the patient should not wait on an approval
 * for that. Sending money back is commercial and needs a person to agree to it,
 * so it sits as a request until an administrator approves or declines.
 */
export function BookingActions({
  bookingId,
  reference,
  status,
  canManage,
  refundStatus = 'none',
  refundAmount,
  refundDeclineReason,
  paymentStatus,
  currency = 'GBP',
}: {
  bookingId: string;
  reference: string;
  status: BookingStatus;
  canManage: boolean;
  refundStatus?: RefundState;
  refundAmount?: number | null;
  refundDeclineReason?: string | null;
  paymentStatus?: string;
  currency?: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<Pending>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isClosed = status === 'cancelled' || status === 'completed' || status === 'no_show';

  async function call(path: string, body?: unknown) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`${API}/api/admin${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        setError(payload.error ?? 'That did not go through. Try again.');
        return false;
      }
      return true;
    } catch {
      setError('We could not reach the server. Try again.');
      return false;
    } finally {
      setBusy(false);
    }
  }

  if (!canManage) {
    return (
      <Card>
        <CardHeader title="Managing this booking" />
        <CardBody>
          <p className="text-micro leading-relaxed text-muted">
            Cancellations, reschedules and refunds are handled by the Peptide MD team. Ask an
            administrator if this appointment needs to move.
          </p>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader title="Actions" description={`Booking ${reference}`} />
      <CardBody className="grid gap-5">
        {done ? (
          <p role="status" className="rounded border border-signal/25 bg-signal-tint px-4 py-3 text-micro leading-relaxed text-ink">
            {done}
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="rounded border border-danger/25 bg-danger-tint px-4 py-3 text-micro leading-relaxed text-danger">
            {error}
          </p>
        ) : null}

        {/* Refunds first when one is waiting, it is money, and it is the
            thing an administrator opened this screen to deal with. */}
        {refundStatus !== 'none' ? (
          <div className="rounded-lg border border-line bg-paper-deep p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-semibold text-ink">Refund</p>
              <Badge
                tone={
                  refundStatus === 'pending' ? 'accent'
                  : refundStatus === 'approved' ? 'signal'
                  : refundStatus === 'failed' ? 'danger'
                  : 'neutral'
                }
              >
                {refundStatus === 'pending' ? 'Awaiting approval'
                  : refundStatus === 'approved' ? 'Refunded'
                  : refundStatus === 'failed' ? 'Failed at Stripe'
                  : 'Declined'}
              </Badge>
            </div>

            {refundAmount ? (
              <p className="mt-2 font-mono text-h3 text-ink">{formatMoney(refundAmount, currency)}</p>
            ) : null}

            {refundStatus === 'declined' && refundDeclineReason ? (
              <p className="mt-2 text-micro leading-relaxed text-muted">{refundDeclineReason}</p>
            ) : null}

            {refundStatus === 'pending' || refundStatus === 'failed' ? (
              pending === 'decline' ? (
                <form
                  className="mt-4 grid gap-3"
                  onSubmit={async (event) => {
                    event.preventDefault();
                    const reason = new FormData(event.currentTarget).get('reason');
                    if (await call(`/bookings/${bookingId}/refund/decline`, { reason: String(reason ?? '') })) {
                      setPending(null);
                      setDone('Refund declined. The reason is on the record.');
                      router.refresh();
                    }
                  }}
                >
                  <Field label="Why is this being refused?" htmlFor="reason" required>
                    <Textarea id="reason" name="reason" rows={2} required />
                  </Field>
                  <div className="flex flex-wrap gap-2">
                    <Button type="submit" variant="danger" size="sm" disabled={busy}>
                      {busy ? 'Saving…' : 'Confirm refusal'}
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setPending(null)}>
                      Back
                    </Button>
                  </div>
                </form>
              ) : (
                <>
                  <p className="mt-3 text-micro leading-relaxed text-muted">
                    {refundStatus === 'failed'
                      ? 'Stripe rejected this refund. Approving tries again.'
                      : 'Nothing has been sent back yet. Approving moves the money.'}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      disabled={busy}
                      onClick={async () => {
                        if (await call(`/bookings/${bookingId}/refund/approve`)) {
                          setDone('Refund approved and sent. The patient has been emailed.');
                          router.refresh();
                        }
                      }}
                    >
                      {busy ? 'Sending…' : 'Approve refund'}
                    </Button>
                    <Button variant="secondary" size="sm" onClick={() => setPending('decline')}>
                      Decline
                    </Button>
                  </div>
                </>
              )
            ) : null}
          </div>
        ) : null}

        {isClosed ? (
          <>
            <p className="text-micro leading-relaxed text-muted">
              This booking is closed. The appointment cannot be changed.
            </p>
            {/* Cancelling and refunding are separate decisions, so a refund
                can still be raised after the fact, a patient rings back, or
                the circumstances turn out differently. */}
            {refundStatus === 'none' && paymentStatus === 'paid' ? (
              <div className="mt-4 rounded-lg border border-line bg-paper-deep p-4">
                <p className="text-sm font-semibold text-ink">No refund was raised</p>
                <p className="mt-1.5 text-micro leading-relaxed text-muted">
                  This booking was paid for but cancelled without a refund. You can still raise one, it will come back here for approval before any money moves.
                </p>
                <Button
                  size="sm"
                  className="mt-4"
                  disabled={busy}
                  onClick={async () => {
                    if (await call(`/bookings/${bookingId}/refund/request`)) {
                      setDone('Refund raised. Approve it below when you are ready.');
                      router.refresh();
                    }
                  }}
                >
                  {busy ? 'Raising…' : 'Raise a refund'}
                </Button>
              </div>
            ) : null}
          </>
        ) : pending === 'cancel' ? (
          <form
            className="grid gap-4"
            onSubmit={async (event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              const ok = await call(`/bookings/${bookingId}/cancel`, {
                reason: String(data.get('reason') ?? ''),
                refund: data.get('refund') === 'on',
              });
              if (ok) {
                setPending(null);
                setDone(
                  data.get('refund') === 'on'
                    ? 'Cancelled. The time is back in the calendar and a refund is waiting for your approval.'
                    : 'Cancelled. The time is back in the calendar. No refund was raised.'
                );
                router.refresh();
              }
            }}
          >
            <p className="text-sm leading-relaxed text-ink">
              Cancelling releases the time back into the shared calendar and emails both the patient
              and the doctor.
            </p>
            <Field label="Reason" htmlFor="reason" required hint="Included in the patient’s email and kept on the record.">
              <Textarea id="reason" name="reason" rows={3} required />
            </Field>
            <Checkbox
              name="refund"
              defaultChecked
              label="Raise a refund for approval"
              description="No money moves now. It appears here for you to approve or decline."
            />
            <div className="flex flex-wrap gap-2">
              <Button type="submit" variant="danger" size="sm" disabled={busy}>
                {busy ? 'Cancelling…' : 'Confirm cancellation'}
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setPending(null)}>
                Keep the booking
              </Button>
            </div>
          </form>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={() => router.push(`/admin/bookings/${bookingId}/reschedule`)}>
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
