import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getPartner, getPartnerVolume, getSettings } from '@/lib/data/client';
import { requirePermission, requireSession } from '@/lib/auth/session';
import { CURRENT_PERIOD } from '@/lib/clock';
import { formatMoney, formatPeriod } from '@/lib/format';
import { AdminShell } from '@/components/admin/AdminShell';
import { PartnerForm } from '@/components/admin/PartnerForm';
import { Badge } from '@/components/ui/Badge';

export const metadata: Metadata = {
  title: 'Edit partner',
  robots: { index: false, follow: false },
};

export default async function EditPartnerPage({ params }: { params: { id: string } }) {
  const session = await requireSession('admin', `/admin/partners/${params.id}`);
  requirePermission(session, 'partners.manage');

  const [partnerRes, settingsRes, volumeRes] = await Promise.all([
    getPartner(params.id),
    getSettings(),
    getPartnerVolume(params.id),
  ]);

  if (!partnerRes.success) notFound();
  if (!settingsRes.success) throw new Error('Settings unavailable');

  const partner = partnerRes.data;
  const volume = volumeRes.success ? volumeRes.data : null;

  return (
    <AdminShell
      user={session}
      crumbs={[
        { label: 'Admin', href: '/admin' },
        { label: 'Partners', href: '/admin/partners' },
        { label: partner.name },
      ]}
      title={partner.name}
      description={
        volume
          ? `${volume.appointmentCount} appointment${volume.appointmentCount === 1 ? '' : 's'} in ${formatPeriod(CURRENT_PERIOD)} · ${formatMoney(volume.runningTotal, volume.currency)} billable so far.`
          : undefined
      }
      actions={
        <Badge tone={partner.status === 'active' ? 'signal' : 'danger'}>
          {partner.status === 'active' ? 'Active' : 'Suspended'}
        </Badge>
      }
    >
      <PartnerForm
        partner={partner}
        defaultRate={settingsRes.data.partnerDefaults.defaultRatePerAppointment}
        defaultRateLimit={settingsRes.data.partnerDefaults.defaultRateLimitPerMinute}
      />
    </AdminShell>
  );
}
