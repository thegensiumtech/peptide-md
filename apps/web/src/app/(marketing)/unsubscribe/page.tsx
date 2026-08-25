import type { Metadata } from 'next';
import Link from 'next/link';
import { PageIntro } from '@/components/marketing/PageIntro';

export const metadata: Metadata = {
  title: 'Unsubscribe',
  robots: { index: false, follow: false },
};

/**
 * Where the unsubscribe link in an email lands.
 *
 * The work happens server-side before this renders, so arriving here means it
 * is done. There is no button to press and nothing further to confirm: making
 * someone click twice to stop hearing from us is the pattern that earns a spam
 * report instead.
 *
 * The API answers identically whether or not the address was on the list, so
 * this page cannot be used to find out who is.
 */
export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; token?: string }>;
}) {
  const { email, token } = await searchParams;

  let done = false;
  if (email && token) {
    const base = process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? '';
    const query = new URLSearchParams({ email, token }).toString();
    done = await fetch(`${base}/api/guide/unsubscribe?${query}`, { cache: 'no-store' })
      .then((r) => r.ok)
      .catch(() => false);
  }

  return (
    <>
      <PageIntro
        eyebrow="Email preferences"
        title={done ? 'You are unsubscribed.' : 'We could not process that link.'}
      />

      <section className="shell mt-12 max-w-prose">
        {done ? (
          <div className="space-y-6 text-lead leading-relaxed text-ink-soft">
            <p>
              We will not email you about peptide therapy or the consultation service again. No
              further action is needed.
            </p>
            <p className="text-sm text-muted">
              You will still receive emails about an appointment you have booked, the confirmation,
              the reminder the day before, and anything about a change or refund. Those are not
              marketing, and withholding them would leave you not knowing when to attend. Cancel the
              appointment itself if you would rather not receive those.
            </p>
          </div>
        ) : (
          <div className="space-y-6 text-lead leading-relaxed text-ink-soft">
            <p>
              The link may have been broken by your email client, or it may be incomplete. Try
              opening it again from the original email.
            </p>
            <p className="text-sm text-muted">
              If it still does not work, email us and we will remove you by hand.
            </p>
          </div>
        )}

        <div className="mt-10">
          <Link
            href="/"
            className="link-cta text-sm text-ink underline decoration-line underline-offset-4 transition-colors hover:decoration-accent"
          >
            Back to the site
          </Link>
        </div>
      </section>
    </>
  );
}
