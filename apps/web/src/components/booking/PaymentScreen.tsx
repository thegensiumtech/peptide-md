'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { isValidEmail } from '@/lib/validation';
import { formatMoney } from '@/lib/format';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { RequisitionCard } from '@/components/marketing/Primitives';
import { startCheckout } from '@/lib/api/booking';
import { useBooking } from './BookingContext';

/**
 * Payment.
 *
 * Card details are never entered here — the patient is handed to Stripe
 * Checkout, so no card data touches Peptide MD at any point. All this screen
 * collects is the address the confirmation goes to.
 *
 * Nothing is held in the diary yet. A patient who abandons Stripe leaves a
 * pending booking and no reserved time, which is the whole reason payment
 * comes before the calendar.
 */
export function PaymentScreen({
  amount,
  currency,
  durationMinutes,
}: {
  amount: number;
  currency: string;
  durationMinutes: number;
}) {
  const { update } = useBooking();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Stripe sends the patient back here if they cancel out of Checkout.
  const cancelled = searchParams.get('cancelled') === '1';

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setFieldError(null);

    const trimmed = email.trim();
    if (!trimmed) {
      setFieldError('Enter the email address your confirmation should go to.');
      return;
    }
    if (!isValidEmail(trimmed)) {
      setFieldError('That email address is not valid.');
      return;
    }

    setSubmitting(true);
    const result = await startCheckout(trimmed);

    if (!result.success) {
      setSubmitting(false);
      setError(result.error);
      return;
    }

    update({
      bookingId: result.data.bookingId,
      bookingReference: result.data.reference,
      paymentReference: result.data.sessionId,
    });

    // Leaves the app entirely; the patient returns to /book/slot.
    window.location.assign(result.data.checkoutUrl);
  }

  return (
    <div className="grid gap-12 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:gap-16">
      <div>
        <p className="eyebrow">Step two · Payment</p>
        <h1 className="mt-5 font-display text-h1 font-medium tracking-[-0.02em] text-ink">
          Pay for your consultation.
        </h1>
        <p className="mt-6 max-w-xl text-lead leading-relaxed text-ink-soft">
          Payment is handled by Stripe. Your card details go straight to them — Peptide MD never
          sees or stores them.
        </p>

        {cancelled ? (
          <div
            role="status"
            className="mt-8 max-w-md rounded-lg border border-amber/30 bg-amber-tint px-5 py-4"
          >
            <p className="text-sm font-semibold text-ink">You came back without paying.</p>
            <p className="mt-1.5 text-micro leading-relaxed text-ink">
              Nothing was charged and no appointment time was held. Start again below whenever you
              are ready.
            </p>
          </div>
        ) : null}

        {error ? (
          <div
            role="alert"
            className="mt-8 max-w-md rounded-lg border border-danger/25 bg-danger-tint px-5 py-4"
          >
            <p className="text-sm font-semibold text-danger">We could not start the payment.</p>
            <p className="mt-1.5 text-micro leading-relaxed text-ink">
              {error}{' '}
              <Link href="/contact" className="underline underline-offset-2">
                Contact us
              </Link>{' '}
              if it keeps happening.
            </p>
          </div>
        ) : null}

        <form onSubmit={handleSubmit} noValidate className="mt-8 grid max-w-md gap-5">
          <Field
            label="Email address"
            htmlFor="email"
            required
            error={fieldError ?? undefined}
            hint="Your confirmation, calendar invite and joining link all go here."
          >
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              aria-invalid={Boolean(fieldError)}
              placeholder="you@example.com"
            />
          </Field>

          <Button type="submit" size="lg" disabled={submitting} className="mt-1">
            {submitting ? 'Taking you to Stripe…' : `Pay ${formatMoney(amount, currency)}`}
          </Button>

          <p className="text-center text-micro leading-relaxed text-muted">
            You will be taken to Stripe to pay securely, then returned here to choose your time.
          </p>
        </form>

        <div className="mt-8 border-t border-line pt-5">
          <Link
            href="/book"
            className="text-micro text-muted underline decoration-line underline-offset-4 transition-colors hover:text-ink"
          >
            ← Back to consultation details
          </Link>
          <p className="mt-2 text-micro text-muted">
            Nothing has been charged yet, so going back here is safe.
          </p>
        </div>
      </div>

      <aside className="lg:sticky lg:top-8 lg:self-start">
        <RequisitionCard
          rows={[
            { label: 'Consultation', value: 'Peptide therapy review' },
            { label: 'Duration', value: `${durationMinutes} minutes` },
            { label: 'Time', value: 'Chosen next' },
            { label: 'Total', value: formatMoney(amount, currency), emphasis: true },
          ]}
        />
        <div className="mt-6 rounded-lg border border-line bg-surface p-5">
          <p className="eyebrow">If payment fails</p>
          <p className="mt-3 text-micro leading-relaxed text-muted">
            No appointment is created and no time is reserved. You can try again straight away —
            nothing is lost.
          </p>
        </div>
      </aside>
    </div>
  );
}
