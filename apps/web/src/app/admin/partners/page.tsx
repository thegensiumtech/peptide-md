import type { Metadata } from 'next';
import Link from 'next/link';
import { getPartners } from '@/lib/api/admin';
import { requirePermission, requireSession } from '@/lib/auth/session';
import { CURRENT_PERIOD } from '@/lib/clock';
import { formatMoney, formatPeriod } from '@/lib/format';
import { AdminShell } from '@/components/admin/AdminShell';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { ButtonLink } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { TableWrap, Td, Th, Tr } from '@/components/ui/Table';

export const metadata: Metadata = {
  title: 'Partners',
  robots: { index: false, follow: false },
};

export default async function PartnersPage() {
  const session = await requireSession('admin', '/admin/partners');
  requirePermission(session, 'partners.manage');

  const partnersRes = await getPartners();
  if (!partnersRes.success) throw new Error('Partners unavailable');

  const partners = partnersRes.data;

  // Volume comes back with each partner, so the list is one request rather
  // than one per row.
  const volumeByPartner = Object.fromEntries(
    partners.map((partner) => [
      partner.id,
      {
        partnerId: partner.id,
        partnerName: partner.name,
        appointmentCount: partner.volume?.appointmentCount ?? 0,
        ratePerAppointment: partner.ratePerAppointment,
        runningTotal: partner.volume?.runningTotal ?? 0,
        currency: partner.currency,
      },
    ])
  );

  const monthTotal = partners.reduce((sum, p) => sum + (p.volume?.runningTotal ?? 0), 0);

  return (
    <AdminShell
      user={session}
      crumbs={[{ label: 'Admin', href: '/admin' }, { label: 'Partners' }]}
      title="Partners"
      description="The companies offering your consultations inside their own sites, and what each has sent this month."
      actions={
        <ButtonLink href="/admin/partners/new" size="sm">
          Add a partner
        </ButtonLink>
      }
    >
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <p className="font-mono text-eyebrow uppercase tracking-[0.14em] text-muted">
          {partners.length} partner{partners.length === 1 ? '' : 's'}
        </p>
        <p className="font-mono text-eyebrow uppercase tracking-[0.14em] text-muted">
          {formatPeriod(CURRENT_PERIOD)} · {formatMoney(monthTotal)} billable so far
        </p>
      </div>

      <Card className="mt-3 overflow-hidden">
        {partners.length === 0 ? (
          <EmptyState
            title="No partners yet"
            description="Adding a partner issues their credentials and lets them start booking into the diary. Nothing needs to be rebuilt or redeployed."
            action={<ButtonLink href="/admin/partners/new" size="sm">Add the first partner</ButtonLink>}
          />
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <Th>Partner</Th>
                <Th>Integration</Th>
                <Th>Status</Th>
                <Th align="right">Rate</Th>
                <Th align="right">This month</Th>
                <Th align="right">Billable</Th>
              </tr>
            </thead>
            <tbody>
              {partners.map((partner) => {
                const volume = volumeByPartner[partner.id];
                return (
                  <Tr key={partner.id}>
                    <Td>
                      <Link href={`/admin/partners/${partner.id}`} className="block max-w-64">
                        <span className="block truncate text-sm font-medium text-ink">
                          {partner.name}
                        </span>
                        <span className="mt-0.5 block truncate font-mono text-eyebrow text-muted">
                          {partner.credentials.clientId}
                        </span>
                      </Link>
                    </Td>
                    <Td>
                      <Badge tone="neutral">
                        {partner.integration === 'api' ? 'Partner API' : 'Embed widget'}
                      </Badge>
                    </Td>
                    <Td>
                      <Badge tone={partner.status === 'active' ? 'signal' : 'danger'}>
                        {partner.status === 'active' ? 'Active' : 'Suspended'}
                      </Badge>
                    </Td>
                    <Td align="right">
                      <span className="font-mono text-sm text-ink">
                        {formatMoney(partner.ratePerAppointment, partner.currency)}
                      </span>
                    </Td>
                    <Td align="right">
                      <span className="font-mono text-sm text-ink">
                        {volume?.appointmentCount ?? 0}
                      </span>
                    </Td>
                    <Td align="right">
                      <span className="font-mono text-sm text-accent">
                        {formatMoney(volume?.runningTotal ?? 0, partner.currency)}
                      </span>
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </TableWrap>
        )}
      </Card>

      <p className="mt-4 max-w-2xl text-micro leading-relaxed text-muted">
        Adding a partner is a data task, not a development one. Create the record, issue their
        credentials, set their rate and configure their branding, nothing is rebuilt or redeployed.
      </p>
    </AdminShell>
  );
}
