import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ButtonLink } from '@/components/ui/Button';

export const metadata: Metadata = {
  title: 'Your guide',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

const API = process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

/**
 * The download link from the email.
 *
 * The token is resolved server-side so the count is recorded and an invalid
 * link says so, rather than the PDF sitting on a guessable public path.
 */
export default async function GuideDownloadPage({ params }: { params: { token: string } }) {
  const response = await fetch(`${API}/api/guide/download/${params.token}`, { cache: 'no-store' }).catch(
    () => null
  );
  const body = response ? await response.json().catch(() => null) : null;

  if (!body?.success) {
    return (
      <section className="shell grid min-h-[60vh] place-items-center py-20 text-center">
        <div className="max-w-md">
          <h1 className="font-display text-h2 font-medium text-ink">That link is not valid.</h1>
          <p className="mt-4 text-lead leading-relaxed text-muted">
            It may have been mistyped. Request the guide again and we will send a fresh link.
          </p>
          <div className="mt-8">
            <ButtonLink href="/guide" size="lg">
              Request the guide
            </ButtonLink>
          </div>
        </div>
      </section>
    );
  }

  redirect(body.data.file as string);
}
