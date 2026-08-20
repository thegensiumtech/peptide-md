'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import { SequenceRail } from '@/components/sequence/SequenceRail';
import { Wordmark } from '@/components/marketing/Wordmark';
import {
  BOOKING_STEPS,
  earliestIncompleteStep,
  stepHref,
  useBooking,
  type BookingStepId,
} from './BookingContext';

/**
 * Frame for every booking step: the rail, the guard, and a deliberately
 * stripped header. Site navigation is removed here on purpose, once a patient
 * is in the flow, the only paths are forward, or out through Contact.
 */
export function BookingShell({
  step,
  children,
}: {
  step: BookingStepId;
  children: React.ReactNode;
}) {
  const { state, ready } = useBooking();
  const router = useRouter();
  const searchParams = useSearchParams();

  const currentIndex = BOOKING_STEPS.findIndex((s) => s.id === step);
  const allowedIndex = BOOKING_STEPS.findIndex((s) => s.id === earliestIncompleteStep(state));

  /**
   * A patient returning from Stripe carries the booking and session on the URL
   * and, for one render, still has `paid: false` in context, the payment has
   * not been verified yet because the screen that verifies it has not mounted.
   *
   * Without this exemption the guard would bounce them straight back to
   * payment holding a receipt, which is the worst possible moment to lose
   * someone. The step is only opened, not trusted: the screen still asks the
   * server whether that session actually paid before showing a calendar.
   */
  const returningFromCheckout =
    Boolean(searchParams.get('booking')) && Boolean(searchParams.get('session'));

  // 'details' is always reachable, it is the entry point, and re-reading what
  // the consultation covers should never be blocked.
  const blocked =
    ready && step !== 'details' && !returningFromCheckout && currentIndex > allowedIndex;

  useEffect(() => {
    if (blocked) router.replace(stepHref(earliestIncompleteStep(state)));
  }, [blocked, router, state]);

  if (!ready || blocked) {
    return (
      <div className="grid min-h-[60vh] place-items-center" role="status" aria-live="polite">
        <p className="font-mono text-eyebrow uppercase tracking-[0.16em] text-muted">
          Checking your booking…
        </p>
      </div>
    );
  }

  return (
    <>
      <header className="border-b border-line bg-paper">
        <div className="shell flex h-16 items-center justify-between gap-4">
          <Link href="/" aria-label="Peptide MD, home">
            <Wordmark />
          </Link>
          <Link
            href="/contact"
            className="text-micro text-muted underline decoration-line underline-offset-4 transition-colors hover:text-ink"
          >
            Need help?
          </Link>
        </div>
      </header>

      <div className="border-b border-line bg-surface">
        <div className="shell py-5">
          <SequenceRail
            steps={BOOKING_STEPS.map((s) => ({ id: s.id, label: s.label }))}
            currentIndex={currentIndex}
            className="mx-auto max-w-2xl"
          />
        </div>
      </div>

      <main id="main" className="shell py-12 sm:py-16">
        {children}
      </main>
    </>
  );
}
