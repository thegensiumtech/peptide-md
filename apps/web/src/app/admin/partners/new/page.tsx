import type { Metadata } from 'next';
import { getSettings } from '@/lib/data/client';
import { requirePermission, requireSession } from '@/lib/auth/session';
import { AdminShell } from '@/components/admin/AdminShell';
import { PartnerForm } from '@/components/admin/PartnerForm';

export const metadata: Metadata = {
  title: 'Add a partner',
  robots: { index: false, follow: false },
};

export default async function NewPartnerPage() {
  const session = await requireSession('admin', '/admin/partners/new');
  requirePermission(session, 'partners.manage');

  const settingsRes = await getSettings();
  if (!settingsRes.success) throw new Error('Settings unavailable');
  const { partnerDefaults } = settingsRes.data;

  return (
    <AdminShell
      user={session}
      crumbs={[
        { label: 'Admin', href: '/admin' },
        { label: 'Partners', href: '/admin/partners' },
        { label: 'Add' },
      ]}
      title="Add a partner"
      description="Create the account, set their rate, and configure the branding their patients will see. Credentials are issued on save."
    >
      <PartnerForm
        partner={null}
        defaultRate={partnerDefaults.defaultRatePerAppointment}
        defaultRateLimit={partnerDefaults.defaultRateLimitPerMinute}
      />
    </AdminShell>
  );
}
