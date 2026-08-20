'use client';

import { useState } from 'react';
import { isValidEmail } from '@/lib/validation';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Checkbox, Field, Input, Select, Textarea } from '@/components/ui/Field';

type Errors = Partial<Record<'name' | 'email' | 'topic' | 'message' | 'consent', string>>;

const TOPICS = [
  'A question before I book',
  'An appointment I already have',
  'Payment or refund',
  'Partnership enquiry',
  'Something else',
];

/**
 * Enquiry form. Validation runs client-side here for immediate feedback; the
 * API validates the same rules again on submit, since client validation is a
 * convenience and never the boundary.
 */
export function ContactForm() {
  const [errors, setErrors] = useState<Errors>({});
  const [sent, setSent] = useState(false);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const next: Errors = {};

    const name = String(data.get('name') ?? '').trim();
    const email = String(data.get('email') ?? '').trim();
    const message = String(data.get('message') ?? '').trim();

    if (!name) next.name = 'Tell us what to call you.';
    if (!email) next.email = 'We need an email address to reply to.';
    else if (!isValidEmail(email)) next.email = 'That email address is not valid.';
    if (message.length < 10) next.message = 'Give us a little more detail so we can answer properly.';
    if (!data.get('consent')) next.consent = 'We need your agreement before we can reply.';

    setErrors(next);
    if (Object.keys(next).length === 0) setSent(true);
  }

  if (sent) {
    return (
      <div
        role="status"
        className="rounded-lg border border-signal/25 bg-signal-tint px-6 py-10 sm:px-10"
      >
        <p className="eyebrow text-signal">Message sent</p>
        <h2 className="mt-4 font-display text-h2 font-medium text-ink">
          Thanks, we have it.
        </h2>
        <p className="mt-4 max-w-md text-lead leading-relaxed text-ink-soft">
          We answer within one working day. If your question turns out to be one the doctor should
          answer rather than us, we will say so rather than guess.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/"
            className="link-cta text-sm text-ink underline decoration-line underline-offset-4 transition-colors hover:decoration-accent"
          >
            Back to the homepage
          </Link>
          <span aria-hidden className="text-muted">
            ·
          </span>
          <Link
            href="/faq"
            className="link-cta text-sm text-ink underline decoration-line underline-offset-4 transition-colors hover:decoration-accent"
          >
            Read the FAQ
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="grid gap-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Your name" htmlFor="name" required error={errors.name}>
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

      <Field label="What is this about?" htmlFor="topic">
        <Select id="topic" name="topic" defaultValue={TOPICS[0]}>
          {TOPICS.map((topic) => (
            <option key={topic}>{topic}</option>
          ))}
        </Select>
      </Field>

      <Field
        label="Message"
        htmlFor="message"
        required
        error={errors.message}
        hint="Do not include clinical detail you would rather only the doctor saw, save that for the intake form."
      >
        <Textarea id="message" name="message" rows={7} aria-invalid={Boolean(errors.message)} />
      </Field>

      <Field label="" error={errors.consent}>
        <Checkbox
          name="consent"
          label="I agree that Peptide MD may use my details to reply to this enquiry."
          description="We do not add you to a mailing list."
        />
      </Field>

      <div className="flex flex-wrap items-center gap-4 pt-1">
        <Button type="submit" size="lg">
          Send message
        </Button>
        <p className="text-micro text-muted">
          By sending you accept our{' '}
          <Link href="/privacy" className="text-ink underline underline-offset-2">
            privacy policy
          </Link>
          .
        </p>
      </div>
    </form>
  );
}
