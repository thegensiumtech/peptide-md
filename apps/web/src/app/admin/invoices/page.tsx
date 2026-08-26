import type { Metadata } from 'next';
import Link from 'next/link';
import { getInvoices, getPartners } from '@/lib/api/admin';
import { requirePermission, requireSession } from '@/lib/auth/session';
import { formatDate, formatMoney, formatPeriod } from '@/lib/format';
import { AdminShell } from '@/components/admin/AdminShell';
import { Card } from '@/components/ui/Card';
import { InvoiceStatusBadge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { TableWrap, Td, Th, Tr } from '@/components/ui/Table';

export const metadata: Metadata = {
  title: 'Invoices',
  robots: { index: false, follow: false },
};

const VIEW_TZ = 'Europe/London';

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: { partner?: string };
}) {
  const session = await requireSession('admin', '/admin/invoices');
  requirePermission(session, 'invoices.manage');

  const [invoicesRes, partnersRes] = await Promise.all([
    getInvoices({ partnerId: searchParams.partner }),
    getPartners(),
  ]);
  if (!invoicesRes.success || !partnersRes.success) throw new Error('Invoices unavailable');

  const invoices = invoicesRes.data.invoices;
  const drafts = invoices.filter((i) => i.status === 'draft');
  const issued = invoices.filter((i) => i.status !== 'draft');
  // Computed by the API over every invoice, not just the page we are showing.
  const outstanding = invoicesRes.data.outstanding;

  const filteredPartner = searchParams.partner
    ? partnersRes.data.find((p) => p.id === searchParams.partner)
    : null;

  return (
    <AdminShell
      user={session}
      crumbs={[{ label: 'Admin', href: '/admin' }, { label: 'Invoices' }]}
      title="Invoices"
      description="Raised automatically at month end from the appointments each partner sent. Review a draft before it goes out."
    >
      {filteredPartner ? (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded border border-line bg-surface px-4 py-3">
          <p className="text-micro text-muted">
            Showing invoices for <span className="text-ink">{filteredPartner.name}</span>
          </p>
          <Link
            href="/admin/invoices"
            className="text-micro text-muted underline decoration-line underline-offset-4 transition-colors hover:text-ink"
          >
            Show all
          </Link>
        </div>
      ) : null}

      {/* Drafts first, they are the ones needing a decision. */}
      <section>
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="font-display text-h3 font-medium text-ink">This month, running</h2>
          <p className="font-mono text-eyebrow uppercase tracking-[0.14em] text-muted">
            Not yet raised
          </p>
        </div>

        <Card className="mt-3 overflow-hidden">
          {drafts.length === 0 ? (
            <EmptyState
              title="No running totals"
              description="Once a partner sends an appointment this month, their draft invoice appears here."
            />
          ) : (
            <TableWrap>
              <thead>
                <tr>
                  <Th>Partner</Th>
                  <Th>Period</Th>
                  <Th align="right">Appointments</Th>
                  <Th align="right">Rate</Th>
                  <Th align="right">Running total</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {drafts.map((invoice) => (
                  <Tr key={invoice.id}>
                    <Td>
                      <Link
                        href={`/admin/invoices/${invoice.id}`}
                        className="text-sm font-medium text-ink"
                      >
                        {invoice.partnerName}
                      </Link>
                    </Td>
                    <Td>
                      <span className="text-sm text-muted">{formatPeriod(invoice.period)}</span>
                    </Td>
                    <Td align="right">
                      <span className="font-mono text-sm text-ink">{invoice.appointmentCount}</span>
                    </Td>
                    <Td align="right">
                      <span className="font-mono text-sm text-muted">
                        {formatMoney(invoice.ratePerAppointment, invoice.currency)}
                      </span>
                    </Td>
                    <Td align="right">
                      <span className="font-mono text-sm text-accent">
                        {formatMoney(invoice.totalAmount, invoice.currency)}
                      </span>
                    </Td>
                    <Td>
                      <InvoiceStatusBadge status={invoice.status} />
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </TableWrap>
          )}
        </Card>
      </section>

      <section className="mt-10">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="font-display text-h3 font-medium text-ink">Raised</h2>
          <p className="font-mono text-eyebrow uppercase tracking-[0.14em] text-muted">
            {formatMoney(outstanding)} outstanding
          </p>
        </div>

        <Card className="mt-3 overflow-hidden">
          {issued.length === 0 ? (
            <EmptyState
              title="Nothing raised yet"
              description="Invoices are generated at the end of each month and listed here with their status."
            />
          ) : (
            <TableWrap>
              <thead>
                <tr>
                  <Th>Invoice</Th>
                  <Th>Partner</Th>
                  <Th>Period</Th>
                  <Th align="right">Appointments</Th>
                  <Th align="right">Total</Th>
                  <Th>Status</Th>
                  <Th>Due</Th>
                </tr>
              </thead>
              <tbody>
                {issued.map((invoice) => (
                  <Tr key={invoice.id}>
                    <Td>
                      <Link
                        href={`/admin/invoices/${invoice.id}`}
                        className="font-mono text-micro text-ink"
                      >
                        {invoice.number}
                      </Link>
                    </Td>
                    <Td>
                      <span className="text-sm text-ink">{invoice.partnerName}</span>
                    </Td>
                    <Td>
                      <span className="text-sm text-muted">{formatPeriod(invoice.period)}</span>
                    </Td>
                    <Td align="right">
                      <span className="font-mono text-sm text-ink">{invoice.appointmentCount}</span>
                    </Td>
                    <Td align="right">
                      <span className="font-mono text-sm text-ink">
                        {formatMoney(invoice.totalAmount, invoice.currency)}
                      </span>
                    </Td>
                    <Td>
                      <InvoiceStatusBadge status={invoice.status} />
                    </Td>
                    <Td>
                      <span className="font-mono text-micro text-muted">
                        {invoice.dueAt ? formatDate(invoice.dueAt, VIEW_TZ) : ', '}
                      </span>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </TableWrap>
          )}
        </Card>
      </section>
    </AdminShell>
  );
}
