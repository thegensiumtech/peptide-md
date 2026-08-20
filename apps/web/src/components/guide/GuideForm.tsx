'use client';

import Link from 'next/link';
import { useState } from 'react';
import { isValidEmail } from '@/lib/validation';
import { Button } from '@/components/ui/Button';
import { Checkbox, Field, Input } from '@/components/ui/Field';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

/**
 * The lead magnet.
 *
 * The download is not conditional on the marketing tick, the guide is the
 * exchange for an address, and making consent the price of it would be both
 * poor practice and hard to defend under UK GDPR. The tick is asked for
 * separately and left unchecked.
 */
export function GuideForm({ source = 'website' }: { source?: string }) {
  const [errors, setErrors] = useState<{ name?: string; email?: string }>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ url: string; name: string } | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = String(data.get('name') ?? '').trim();
    const email = String(data.get('email') ?? '').trim();

    const next: typeof errors = {};
    if (!name) next.name = 'Tell us what to call you.';
    if (!email) next.email = 'We need an email address to send it to.';
    else if (!isValidEmail(email)) next.email = 'That email address is not valid.';
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`${API}/api/guide/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          marketingConsent: data.get('marketing') === 'on',
          source,
          website: String(data.get('website') ?? ''),
        }),
      });
      const body = await response.json();
      if (!response.ok || !body.success) {
        setError(body.error ?? 'We could not send the guide. Try again in a moment.');
        return;
      }
      setDone({ url: body.data.downloadUrl ?? '/guides/peptide-md-guide.pdf', name });
    } catch {
      setError('We could not reach the server. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-lg border border-signal/25 bg-signal-tint px-6 py-8">
        <p className="eyebrow text-signal">On its way</p>
        <h3 className="mt-3 font-display text-h3 font-medium text-ink">
          Thanks{done.name ? `, ${done.name.split(' ')[0]}` : ''}, it is in your inbox.
        </h3>
        <p className="mt-3 text-sm leading-relaxed text-ink-soft">
          We have emailed you a copy. You can also read it right now.
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-4">
          <Button onClick={() => window.open(done.url, '_blank')}>Open the guide</Button>
          <Link href="/book" className="link-cta text-sm text-ink underline decoration-line underline-offset-4">
            Or book a consultation
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="grid gap-4">
      {error ? (
        <p role="alert" className="rounded border border-danger/25 bg-danger-tint px-4 py-3 text-micro leading-relaxed text-danger">
          {error}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Your name" htmlFor="guide-name" required error={errors.name}>
          <Input id="guide-name" name="name" autoComplete="name" aria-invalid={Boolean(errors.name)} />
        </Field>
        <Field label="Email" htmlFor="guide-email" required error={errors.email}>
          <Input id="guide-email" name="email" type="email" autoComplete="email" aria-invalid={Boolean(errors.email)} />
        </Field>
      </div>

      {/* Honeypot. Hidden from people, tempting to bots. */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden
        className="absolute h-px w-px overflow-hidden opacity-0"
      />

      <Checkbox
        name="marketing"
        label="Email me occasionally about peptide therapy and the consultation service."
        description="Optional, you get the guide either way. Unsubscribe at any time."
      />

      <div className="flex flex-wrap items-center gap-4 pt-1">
        <Button type="submit" size="lg" disabled={busy}>
          {busy ? 'Sending…' : 'Send me the guide'}
        </Button>
        <p className="text-micro text-muted">
          No spam. See our{' '}
          <Link href="/privacy" className="text-ink underline underline-offset-2">
            privacy policy
          </Link>
          .
        </p>
      </div>
    </form>
  );
}
