import type { Metadata } from 'next';
import { requirePermission, requireSession } from '@/lib/auth/session';
import { apiFetch } from '@/lib/api/server';
import { formatDateTime } from '@/lib/format';
import { AdminShell } from '@/components/admin/AdminShell';
import { StatTile } from '@/components/admin/StatTile';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { TableWrap, Td, Th, Tr } from '@/components/ui/Table';

export const metadata: Metadata = {
  title: 'Guide downloads',
  robots: { index: false, follow: false },
};

const VIEW_TZ = 'Europe/London';

interface Lead {
  id: string;
  name: string;
  email: string;
  source: string;
  marketingConsent: boolean;
  downloadCount: number;
  emailSent: boolean;
  createdAt: string;
}

export default async function LeadsPage() {
  const session = await requireSession('admin', '/admin/leads');
  // Marketing contacts are commercial, not clinical — the doctor role has no
  // business in this list.
  requirePermission(session, 'settings.manage');

  const result = await apiFetch<{ total: number; consented: number; leads: Lead[] }>(
    '/api/admin/leads?limit=100'
  );
  if (!result.success || !result.data) throw new Error('Leads unavailable');

  const { total, consented, leads } = result.data;
  const bySource = leads.reduce<Record<string, number>>((acc, l) => {
    acc[l.source] = (acc[l.source] ?? 0) + 1;
    return acc;
  }, {});
  const topSource = Object.entries(bySource).sort((a, b) => b[1] - a[1])[0];

  return (
    <AdminShell
      user={session}
      crumbs={[{ label: 'Admin', href: '/admin' }, { label: 'Guide downloads' }]}
      title="Guide downloads"
      description="Everyone who has asked for the peptide guide. These are marketing contacts, not patients — nobody here has booked anything."
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile label="Total downloads" value={String(total)} detail="Since the guide went live" />
        <StatTile
          label="Agreed to marketing"
          value={String(consented)}
          detail={total > 0 ? `${Math.round((consented / total) * 100)}% of downloads` : 'None yet'}
          tone="accent"
        />
        <StatTile
          label="Best source"
          value={topSource ? String(topSource[1]) : '0'}
          detail={topSource ? `from ${topSource[0].replace(/-/g, ' ')}` : 'No downloads yet'}
        />
      </div>

      <Card className="mt-8 overflow-hidden">
        {leads.length === 0 ? (
          <EmptyState
            title="No downloads yet"
            description="When someone asks for the guide from the homepage or the guide page, they appear here within seconds."
          />
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <Th>When</Th>
                <Th>Name</Th>
                <Th>Email</Th>
                <Th>Came from</Th>
                <Th>Marketing</Th>
                <Th align="right">Opened</Th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <Tr key={lead.id}>
                  <Td className="whitespace-nowrap">
                    <span className="font-mono text-micro text-muted">
                      {formatDateTime(lead.createdAt, VIEW_TZ)}
                    </span>
                  </Td>
                  <Td>
                    <span className="text-sm font-medium text-ink">{lead.name}</span>
                  </Td>
                  <Td>
                    <a
                      href={`mailto:${lead.email}`}
                      className="font-mono text-micro text-ink underline decoration-line underline-offset-4"
                    >
                      {lead.email}
                    </a>
                    {!lead.emailSent ? (
                      <span className="ml-2 font-mono text-eyebrow uppercase text-danger">
                        email failed
                      </span>
                    ) : null}
                  </Td>
                  <Td>
                    <span className="font-mono text-micro text-muted">
                      {lead.source.replace(/-/g, ' ')}
                    </span>
                  </Td>
                  <Td>
                    {lead.marketingConsent ? (
                      <Badge tone="signal">Opted in</Badge>
                    ) : (
                      <Badge tone="neutral">Guide only</Badge>
                    )}
                  </Td>
                  <Td align="right">
                    <span className="font-mono text-sm text-ink">{lead.downloadCount}</span>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </TableWrap>
        )}
      </Card>

      <p className="mt-4 max-w-2xl text-micro leading-relaxed text-muted">
        Only email people marked <strong>Opted in</strong>. “Guide only” means they took the guide
        and did not agree to marketing — emailing them anyway would breach UK GDPR and the consent
        wording we showed them.
      </p>
    </AdminShell>
  );
}
