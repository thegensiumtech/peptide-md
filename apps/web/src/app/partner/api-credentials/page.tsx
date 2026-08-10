import type { Metadata } from 'next';
import { getPartnerMe, toPartner } from '@/lib/api/partner';
import { requirePartnerId, requireSession } from '@/lib/auth/session';
import { PartnerShell } from '@/components/partner/PartnerShell';
import { CredentialsPanel } from '@/components/partner/CredentialsPanel';

export const metadata: Metadata = {
  title: 'API credentials',
  robots: { index: false, follow: false },
};

export default async function PartnerCredentialsPage() {
  const session = await requireSession('partner', '/partner/api-credentials');
  requirePartnerId(session);

  const meRes = await getPartnerMe();
  if (!meRes.success) throw new Error('Partner unavailable');
  const partner = toPartner(meRes.data);

  return (
    <PartnerShell
      user={session}
      partner={partner}
      title="API credentials"
      description="What your developers need to book into Dr Hartley’s diary from your own system."
    >
      <CredentialsPanel partner={partner} />
    </PartnerShell>
  );
}
