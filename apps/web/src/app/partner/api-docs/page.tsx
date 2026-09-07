import type { Metadata } from 'next';
import { getPartnerMe, toPartner } from '@/lib/api/partner';
import { requirePartnerId, requireSession } from '@/lib/auth/session';
import { PartnerShell } from '@/components/partner/PartnerShell';
import { DocsBody } from '@/components/partner/docs/DocsBody';
import { DocsToolbar } from '@/components/partner/docs/DocsToolbar';

export const metadata: Metadata = {
  title: 'API documentation',
  robots: { index: false, follow: false },
};

/**
 * The partner API reference, signed in.
 *
 * Identical content to the shared link, from the same component, with two
 * differences: the reader is authenticated so their live client id is shown
 * alongside the sandbox one, and the endpoint tester will let them switch to
 * live if they choose to.
 */
export default async function PartnerApiDocsPage() {
  const session = await requireSession('partner', '/partner/api-docs');
  requirePartnerId(session);

  const meRes = await getPartnerMe();
  if (!meRes.success) throw new Error('Partner unavailable');
  const partner = toPartner(meRes.data);

  // Whatever origin this deployment actually serves the API from, so the
  // examples are runnable rather than illustrative.
  const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

  return (
    <PartnerShell
      user={session}
      partner={partner}
      title="API documentation"
      description="Everything needed to book into Dr Jinks’s diary from your own system. Build against the sandbox first; it is a separate diary, so nothing you do there reaches a real patient."
      actions={<DocsToolbar />}
    >
      <DocsBody
        baseUrl={baseUrl}
        partnerName={partner.branding.displayName || partner.name}
        sandboxClientId={partner.sandboxCredentials?.clientId ?? null}
        liveClientId={partner.credentials.clientId}
      />
    </PartnerShell>
  );
}
