import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { DocsBody } from '@/components/partner/docs/DocsBody';
import { DocsToolbar } from '@/components/partner/docs/DocsToolbar';

export const metadata: Metadata = {
  title: 'Partner API documentation',
  // Never indexed. The link is meant to be passed to a named team, not found.
  robots: { index: false, follow: false, nocache: true },
};

/**
 * The partner API reference, opened by a shared link instead of a login.
 *
 * This exists so an admin can hand a partner's development team the reference
 * without provisioning accounts for people who will never use the portal. The
 * token in the URL is the only credential, so the page is deliberately
 * narrow: the partner's display name, their sandbox client id, and the
 * documentation. No secret, no live client id, nothing about any other
 * partner, and nothing about a patient.
 *
 * Rendered per request rather than cached, so revoking a link takes effect on
 * the next load rather than whenever a cache happens to expire.
 */
export const dynamic = 'force-dynamic';

interface SharedDocs {
  partnerName: string;
  sandboxClientId: string | null;
  label: string;
  expiresAt: string | null;
}

async function loadSharedDocs(token: string): Promise<SharedDocs | null> {
  const base =
    process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

  const response = await fetch(`${base}/api/docs/${encodeURIComponent(token)}`, {
    cache: 'no-store',
  }).catch(() => null);

  if (!response?.ok) return null;
  const body = await response.json().catch(() => null);
  return body?.data ?? null;
}

export default async function SharedApiDocsPage({ params }: { params: { token: string } }) {
  const docs = await loadSharedDocs(params.token);
  if (!docs) notFound();

  // The origin a developer would actually call, so every example is runnable
  // rather than illustrative.
  const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

  return (
    <div className="min-h-screen bg-paper">
      <header className="border-b border-line bg-surface">
        <div className="shell flex flex-wrap items-center justify-between gap-4 py-5">
          <div>
            <p className="font-mono text-eyebrow uppercase tracking-[0.14em] text-muted">
              Peptide MD · Partner API
            </p>
            <p className="mt-1 font-display text-h3 font-medium text-ink">
              Reference for {docs.partnerName}
            </p>
          </div>
          <DocsToolbar />
        </div>
      </header>

      <main className="shell py-12">
        <div className="rounded-lg border border-line bg-surface px-5 py-4 sm:px-6">
          <p className="text-sm leading-relaxed text-ink-soft">
            This is a shared, read-only copy of the integration reference, prepared for{' '}
            {docs.partnerName}&rsquo;s development team. It contains the sandbox client id and no
            secret of any kind. Ask your account owner at {docs.partnerName} for the secret and,
            when you are ready to go live, for the live credentials.
          </p>
          {docs.expiresAt ? (
            <p className="mt-2 font-mono text-micro uppercase tracking-[0.14em] text-muted">
              This link stops working on{' '}
              {new Date(docs.expiresAt).toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </p>
          ) : null}
        </div>

        <div className="mt-12">
          <DocsBody
            baseUrl={baseUrl}
            partnerName={docs.partnerName}
            sandboxClientId={docs.sandboxClientId}
            shared
          />
        </div>
      </main>

      <footer className="border-t border-line py-8">
        <div className="shell">
          <p className="text-micro leading-relaxed text-muted">
            Peptide MD partner API. Questions about this document, or about going live, go to your
            account owner at {docs.partnerName}.
          </p>
        </div>
      </footer>
    </div>
  );
}
