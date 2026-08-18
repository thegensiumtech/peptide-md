'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { isValidEmail } from '@/lib/validation';
import { formatDate, formatTime, formatWeekday, timezoneLabel } from '@/lib/format';
import { Button } from '@/components/ui/Button';
import { Checkbox, Field, Input, Textarea } from '@/components/ui/Field';
import { submitIntake } from '@/lib/api/booking';
import { useBooking } from './BookingContext';

type FieldName =
  | 'name'
  | 'email'
  | 'phone'
  | 'concern'
  | 'compounds'
  | 'history'
  | 'consentClinical'
  | 'consentTerms';

type Errors = Partial<Record<FieldName, string>>;

/**
 * Intake.
 *
 * The five questions the doctor reads before joining. Consent is captured
 * explicitly and separately — one box for the clinical record, one for the
 * terms — rather than bundled into a single catch-all tick.
 */
export function IntakeForm() {
  const { state, update } = useBooking();
  const router = useRouter();
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const slot = state.slot;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const read = (key: FieldName) => String(data.get(key) ?? '').trim();
    const next: Errors = {};

    if (!read('name')) next.name = 'The doctor needs to know who he is speaking to.';

    const email = read('email');
    if (!email) next.email = 'We send your confirmation and joining link here.';
    else if (!isValidEmail(email)) next.email = 'That email address is not valid.';

    if (!read('phone')) next.phone = 'Used only if we cannot reach you by email on the day.';

    if (read('concern').length < 10) {
      next.concern = 'A sentence or two is enough — it is what the doctor reads first.';
    }
    if (!read('compounds')) {
      next.compounds = 'Write “none” if you are not taking anything. Leaving it blank is not the same.';
    }
    if (!read('history')) {
      next.history = 'Write “none” if there is nothing relevant.';
    }
    if (!data.get('consentClinical')) {
      next.consentClinical = 'The doctor cannot advise without your consent to record this.';
    }
    if (!data.get('consentTerms')) {
      next.consentTerms = 'Please confirm you have read the terms and the disclaimer.';
    }

    setErrors(next);
    if (Object.keys(next).length > 0) {
      // Move focus to the first problem rather than leaving the user hunting.
      document.getElementById(Object.keys(next)[0]!)?.focus();
      return;
    }

    if (!state.bookingId || !state.holdToken) {
      setSubmitError('Your held time has expired. Choose another — you will not be charged again.');
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    const result = await submitIntake({
      bookingId: state.bookingId,
      holdToken: state.holdToken,
      name: read('name'),
      email: read('email'),
      phone: read('phone'),
      timezone: state.timezone,
      answers: [
        { question: 'What would you like to discuss with the doctor?', answer: read('concern') },
        { question: 'Are you currently using any peptides or compounds?', answer: read('compounds') },
        { question: 'Relevant medical history or current medication', answer: read('history') },
      ],
      consentClinical: true,
      consentTerms: true,
    });

    if (!result.success) {
      setSubmitting(false);
      setSubmitError(result.error);
      // The hold lapsed while they were typing. Send them back for a new time
      // rather than leaving a button that can never succeed.
      if (result.code === 'HOLD_EXPIRED' || result.code === 'SLOT_TAKEN') {
        update({ slot: null, holdToken: null, holdExpiresAt: null });
      }
      return;
    }

    update({
      intakeComplete: true,
      patientName: read('name'),
      patientEmail: read('email'),
      bookingReference: result.data.reference,
      doctorName: result.data.doctorName,
      slot: { startsAt: result.data.startsAt, endsAt: result.data.endsAt },
    });
    router.push('/book/confirmed');
  }

  return (
    <div className="grid gap-12 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:gap-16">
      <div>
        <p className="eyebrow">Step four · Before you join</p>
        <h1 className="mt-5 font-display text-h1 font-medium tracking-[-0.02em] text-ink">
          Tell the doctor what this is about.
        </h1>
        <p className="mt-6 max-w-xl text-lead leading-relaxed text-ink-soft">
          He reads this before the call, so the twenty minutes start at the useful part rather than
          at the basics. Two minutes now buys you most of a consultation.
        </p>

        <form onSubmit={handleSubmit} noValidate className="mt-10 grid gap-6">
          <fieldset className="grid gap-5">
            <legend className="eyebrow mb-3">Who you are</legend>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Full name" htmlFor="name" required error={errors.name}>
                <Input id="name" name="name" autoComplete="name" aria-invalid={Boolean(errors.name)} />
              </Field>
              <Field label="Email" htmlFor="email" required error={errors.email}>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  aria-invalid={Boolean(errors.email)}
                />
              </Field>
            </div>
            <Field
              label="Phone"
              htmlFor="phone"
              required
              error={errors.phone}
              hint="Only used if we cannot reach you by email on the day."
            >
              <Input
                id="phone"
                name="phone"
                type="tel"
                autoComplete="tel"
                aria-invalid={Boolean(errors.phone)}
                className="font-mono"
              />
            </Field>
          </fieldset>

          <fieldset className="grid gap-5 border-t border-line pt-6">
            <legend className="eyebrow mb-3">What the doctor needs</legend>

            <Field
              label="What would you like to discuss?"
              htmlFor="concern"
              required
              error={errors.concern}
            >
              <Textarea
                id="concern"
                name="concern"
                rows={4}
                placeholder="What you are trying to change, and what has happened so far."
                aria-invalid={Boolean(errors.concern)}
              />
            </Field>

            <Field
              label="Are you currently using any peptides or other compounds?"
              htmlFor="compounds"
              required
              error={errors.compounds}
              hint="Include the compound, the dose and where it came from, if you know."
            >
              <Textarea
                id="compounds"
                name="compounds"
                rows={3}
                placeholder="e.g. BPC-157, 250mcg daily, four weeks. Or simply: none."
                aria-invalid={Boolean(errors.compounds)}
              />
            </Field>

            <Field
              label="Relevant medical history and current medication"
              htmlFor="history"
              required
              error={errors.history}
              hint="Conditions, prescriptions, allergies — anything that could change what is safe for you."
            >
              <Textarea
                id="history"
                name="history"
                rows={3}
                aria-invalid={Boolean(errors.history)}
              />
            </Field>
          </fieldset>

          <fieldset className="grid gap-4 border-t border-line pt-6">
            <legend className="eyebrow mb-3">Consent</legend>
            <Field label="" error={errors.consentClinical}>
              <Checkbox
                id="consentClinical"
                name="consentClinical"
                label="I consent to Dr Hartley recording and holding these answers as part of my clinical record."
                description="Kept in line with UK medical record-keeping guidance and never shared with partner companies."
              />
            </Field>
            <Field label="" error={errors.consentTerms}>
              <Checkbox
                id="consentTerms"
                name="consentTerms"
                label={
                  <>
                    I have read the{' '}
                    <Link href="/terms" target="_blank" className="underline underline-offset-2">
                      terms
                    </Link>{' '}
                    and the{' '}
                    <Link
                      href="/medical-disclaimer"
                      target="_blank"
                      className="underline underline-offset-2"
                    >
                      medical disclaimer
                    </Link>
                    , and understand this is not a prescribing service.
                  </>
                }
              />
            </Field>
          </fieldset>

          {submitError ? (
            <div
              role="alert"
              className="rounded-lg border border-danger/25 bg-danger-tint px-5 py-4"
            >
              <p className="text-sm font-semibold text-danger">We could not confirm your booking.</p>
              <p className="mt-1.5 text-micro leading-relaxed text-ink">
                {submitError} You have already paid — do not pay again.
              </p>
              {!state.holdToken ? (
                <Link
                  href="/book/slot"
                  className="mt-3 inline-block text-micro text-ink underline underline-offset-4"
                >
                  Choose another time
                </Link>
              ) : null}
            </div>
          ) : null}

          <div className="pt-2">
            <Button type="submit" size="lg" disabled={submitting}>
              {submitting ? 'Confirming…' : 'Confirm my appointment'}
            </Button>
          </div>
        </form>
      </div>

      <aside className="lg:sticky lg:top-8 lg:self-start">
        <div className="rounded-lg border border-line bg-surface p-6">
          <p className="eyebrow">Held for you</p>
          {slot ? (
            <>
              <p className="mt-4 font-display text-h3 font-medium text-ink">
                {formatWeekday(slot.startsAt, state.timezone)}
              </p>
              <p className="mt-1 text-base text-ink-soft">
                {formatDate(slot.startsAt, state.timezone)}
              </p>
              <p className="mt-4 font-mono text-h3 text-accent">
                {formatTime(slot.startsAt, state.timezone)} –{' '}
                {formatTime(slot.endsAt, state.timezone)}
              </p>
              <p className="mt-1 font-mono text-eyebrow uppercase tracking-[0.14em] text-muted">
                {timezoneLabel(state.timezone)}
              </p>
            </>
          ) : null}

          {/* Changing the time is an explicit action, not browser-back —
              re-picking has to release the slot currently held. */}
          <Link
            href="/book/slot"
            className="mt-6 inline-block text-micro text-muted underline decoration-line underline-offset-4 transition-colors hover:text-ink"
          >
            Change time
          </Link>
        </div>

        <div className="mt-6 rounded-lg border border-line bg-paper-deep p-5">
          <p className="eyebrow">Privacy</p>
          <p className="mt-3 text-micro leading-relaxed text-muted">
            These answers go to the doctor and to the Peptides MD team who administer bookings. They
            are never shared with a partner company and never used for marketing.
          </p>
        </div>
      </aside>
    </div>
  );
}
