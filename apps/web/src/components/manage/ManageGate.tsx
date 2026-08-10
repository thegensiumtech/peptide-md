'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { requestAccessCode, verifyAccessCode } from '@/lib/api/manage';
import { useManageSession } from './ManageSession';
import { Notice } from './ManagePrimitives';

/** Matches the server's cooldown, so the resend link is dead while it would be ignored. */
const RESEND_COOLDOWN_SECONDS = 60;

/**
 * The way in.
 *
 * An email address is not a secret — plenty of people know yours — and when a
 * patient is seeing a doctor is clinical information. So the address alone
 * opens nothing here. It gets a six-digit code sent to that inbox, and proving
 * you can read the inbox is what opens the screens behind this.
 *
 * Children are rendered only once a session exists, so no screen behind the
 * gate has to consider the unauthenticated case.
 */
export function ManageGate({
  reference,
  children,
}: {
  /** Shown on the way in when the patient arrived from a link in their email. */
  reference?: string;
  children: React.ReactNode;
}) {
  const { session, ready, endedReason, open } = useManageSession();
  const [email, setEmail] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  /** Only ever set in local development — see CodeRequestResult.devCode. */
  const [devCode, setDevCode] = useState<string | undefined>(undefined);

  if (!ready) {
    return (
      <div className="grid place-items-center py-16" role="status" aria-live="polite">
        <p className="font-mono text-eyebrow uppercase tracking-[0.16em] text-muted">
          Checking your details…
        </p>
      </div>
    );
  }

  if (session) return <>{children}</>;

  if (sentTo) {
    return (
      <CodeStep
        email={sentTo}
        reference={reference}
        devCode={devCode}
        onVerified={open}
        onStartOver={() => {
          setSentTo(null);
          setDevCode(undefined);
        }}
      />
    );
  }

  return (
    <EmailStep
      email={email}
      reference={reference}
      expired={endedReason === 'expired'}
      onEmailChange={setEmail}
      onSent={(address, code) => {
        setSentTo(address);
        setDevCode(code);
      }}
    />
  );
}

// --- Step one ----------------------------------------------------------------

function EmailStep({
  email,
  reference,
  expired,
  onEmailChange,
  onSent,
}: {
  email: string;
  reference?: string;
  expired: boolean;
  onEmailChange: (value: string) => void;
  onSent: (email: string, devCode?: string) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (pending) return;

    const trimmed = email.trim();
    if (!trimmed) {
      setError('Enter the email address you booked with.');
      return;
    }

    setPending(true);
    setError(null);
    const response = await requestAccessCode(trimmed);
    setPending(false);

    if (!response.success) {
      setError(response.error);
      return;
    }
    onSent(trimmed.toLowerCase(), response.data.devCode);
  }

  return (
    <GateCard onSubmit={submit}>
      {expired ? (
        <Notice tone="amber" className="mb-6">
          Your session timed out. Confirm your email again to carry on.
        </Notice>
      ) : null}

      <p className="eyebrow">Step one</p>
      <h2 className="mt-4 font-display text-h3 font-medium text-ink">
        Which email did you book with?
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        We will email you a six-digit code. Your appointments are clinical information, so we check
        it really is you before showing them — there is no password and no account to create.
      </p>

      {reference ? <ReferenceLine reference={reference} /> : null}

      <Field
        label="Email address"
        htmlFor="manage-email"
        required
        className="mt-6"
        hint="The address your confirmation email was sent to."
      >
        <Input
          id="manage-email"
          type="email"
          name="email"
          value={email}
          autoComplete="email"
          inputMode="email"
          placeholder="you@example.com"
          aria-invalid={error ? true : undefined}
          onChange={(event) => onEmailChange(event.target.value)}
        />
      </Field>

      {error ? (
        <Notice tone="danger" className="mt-5">
          {error}
        </Notice>
      ) : null}

      <Button type="submit" size="lg" className="mt-6 w-full" disabled={pending}>
        {pending ? 'Sending…' : 'Email me a code'}
      </Button>

      <GateFooter />
    </GateCard>
  );
}

// --- Step two ----------------------------------------------------------------

function CodeStep({
  email,
  reference,
  devCode,
  onVerified,
  onStartOver,
}: {
  email: string;
  reference?: string;
  devCode?: string;
  onVerified: (session: { email: string; token: string; expiresAt: string }) => void;
  onStartOver: () => void;
}) {
  // Prefilled in local development, where the email is never delivered. In any
  // environment that actually sends mail the API omits the code entirely, so
  // this starts empty and the banner below never renders.
  const [code, setCode] = useState(devCode ?? '');
  const [shownCode, setShownCode] = useState(devCode);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [resendIn, setResendIn] = useState(RESEND_COOLDOWN_SECONDS);
  const [resent, setResent] = useState(false);

  const inputRef = useRef<HTMLInputElement | null>(null);

  // Straight into the field — the patient is arriving back from their inbox
  // with six digits in their head or on their clipboard.
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (pending) return;

    const digits = code.replace(/\D/g, '');
    if (digits.length !== 6) {
      setError('The code is six digits.');
      return;
    }

    setPending(true);
    setError(null);
    const response = await verifyAccessCode(email, digits);
    setPending(false);

    if (!response.success) {
      setError(response.error);
      setCode('');
      inputRef.current?.focus();
      return;
    }
    onVerified(response.data);
  }

  async function resend() {
    if (resendIn > 0) return;
    setResent(false);
    setError(null);
    const response = await requestAccessCode(email);
    if (!response.success) {
      setError(response.error);
      return;
    }
    setResent(true);
    setResendIn(RESEND_COOLDOWN_SECONDS);
    if (response.data.devCode) {
      setShownCode(response.data.devCode);
      setCode(response.data.devCode);
    }
  }

  return (
    <GateCard onSubmit={submit}>
      <p className="eyebrow">Step two</p>
      <h2 className="mt-4 font-display text-h3 font-medium text-ink">Enter the code we sent.</h2>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        If <span className="break-all text-ink">{email}</span> has appointments with us, a six-digit
        code is on its way. It works once and expires in ten minutes.
      </p>

      {reference ? <ReferenceLine reference={reference} /> : null}

      {/* Development only. The API withholds the code unless it is both a
          non-production build and wired to an email provider that delivers
          nothing, so in a deployed environment this cannot render. */}
      {shownCode ? (
        <div className="mt-6 rounded border border-dashed border-amber/50 bg-amber-tint px-4 py-3">
          <p className="font-mono text-eyebrow uppercase tracking-[0.14em] text-amber">
            Development · email not delivered
          </p>
          <p className="mt-2 font-mono text-h3 tracking-[0.3em] text-ink">
            {shownCode.slice(0, 3)} {shownCode.slice(3)}
          </p>
          <p className="mt-2 text-micro leading-relaxed text-muted">
            Filled in below for you. On a deployed site this box does not exist and the code only
            reaches the patient’s inbox.
          </p>
        </div>
      ) : null}

      <Field label="Six-digit code" htmlFor="manage-code" required className="mt-6">
        <Input
          id="manage-code"
          ref={inputRef}
          name="code"
          value={code}
          inputMode="numeric"
          // Lets a phone offer the code straight from the notification.
          autoComplete="one-time-code"
          maxLength={7}
          placeholder="000000"
          aria-invalid={error ? true : undefined}
          className="text-center font-mono text-h3 tracking-[0.4em]"
          onChange={(event) => setCode(event.target.value)}
        />
      </Field>

      {error ? (
        <Notice tone="danger" className="mt-5">
          {error}
        </Notice>
      ) : null}

      {resent && !error ? (
        <Notice tone="signal" className="mt-5">
          A new code is on its way. The previous one no longer works.
        </Notice>
      ) : null}

      <Button type="submit" size="lg" className="mt-6 w-full" disabled={pending}>
        {pending ? 'Checking…' : 'Open my appointments'}
      </Button>

      <div className="mt-5 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-micro text-muted">
        <button
          type="button"
          onClick={resend}
          disabled={resendIn > 0}
          className="text-ink underline underline-offset-2 disabled:text-muted disabled:no-underline"
        >
          {resendIn > 0 ? `Send another code in ${resendIn}s` : 'Send another code'}
        </button>
        <span aria-hidden>·</span>
        <button
          type="button"
          onClick={onStartOver}
          className="text-ink underline underline-offset-2"
        >
          Use a different email
        </button>
      </div>

      <GateFooter />
    </GateCard>
  );
}

// --- Shared chrome -----------------------------------------------------------

function GateCard({
  onSubmit,
  children,
}: {
  onSubmit: (event: React.FormEvent) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-xl">
      <form
        onSubmit={onSubmit}
        noValidate
        className="rounded-lg border border-line bg-surface p-6 sm:p-8"
      >
        {children}
      </form>
    </div>
  );
}

function ReferenceLine({ reference }: { reference: string }) {
  return (
    <div className="mt-6 flex items-baseline justify-between gap-4 border-y border-line py-3">
      <span className="text-micro text-muted">Reference</span>
      <span className="font-mono text-base text-ink">{reference}</span>
    </div>
  );
}

function GateFooter() {
  return (
    <p className="mt-5 text-center text-micro leading-relaxed text-muted">
      Cannot find it?{' '}
      <Link href="/contact" className="text-ink underline underline-offset-2">
        Contact us
      </Link>{' '}
      and we will look it up for you.
    </p>
  );
}
