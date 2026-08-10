import type { Metadata } from 'next';
import { getPartnerInvoices, getPartnerMe, toPartner } from '@/lib/api/partner';
import { requirePartnerId, requireSession } from '@/lib/auth/session';
import { CURRENT_PERIOD } from '@/lib/clock';
import { formatDate, formatMoney, formatPeriod } from '@/lib/format';
import { PartnerShell } from '@/components/partner/PartnerShell';
import { PartnerInvoiceRow } from '@/components/partner/PartnerInvoiceRow';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { TableWrap, Td, Th, Tr } from '@/components/ui/Table';

export const metadata: Metadata = {
  title: 'Your invoices',
  robots: { index: false, follow: false },
};

const VIEW_TZ = 'Europe/London';

export default async function PartnerInvoicesPage() {
  const session = await requireSession('partner', '/partner/invoices');
  requirePartnerId(session);

  const [meRes, invoicesRes] = await Promise.all([getPartnerMe(), getPartnerInvoices()]);

  if (!meRes.success || !invoicesRes.success) {
    throw new Error('Invoice data unavailable');
  }

  const partner = toPartner(meRes.data);
  const volume = meRes.data.volume;
  const issued = invoicesRes.data.filter((i) => i.status !== 'draft');
  const outstanding = issued
    .filter((i) => i.status === 'sent' || i.status === 'overdue')
    .reduce((sum, i) => sum + i.totalAmount, 0);

  return (
    <PartnerShell
      user={session}
      partner={partner}
      title="Your invoices"
      description="Raised on the first of each month from the appointments you sent the month before."
    >
      <Card>
        <CardHeader
          title={`${formatPeriod(CURRENT_PERIOD)} — still counting`}
          description="Not yet raised. This is what the invoice would be if the month closed now."
        />
        <CardBody>
          <div className="flex flex-wrap items-end justify-between gap-6">
            <dl className="flex flex-wrap gap-x-10 gap-y-4">
              <div>
                <dt className="eyebrow">Appointments</dt>
                <dd className="mt-1.5 font-mono text-h3 text-ink">{volume.appointmentCount}</dd>
              </div>
              <div>
                <dt className="eyebrow">Rate</dt>
                <dd className="mt-1.5 font-mono text-h3 text-ink">
                  {formatMoney(volume.ratePerAppointment, volume.currency)}
                </dd>
              </div>
              <div>
                <dt className="eyebrow">Running total</dt>
                <dd className="mt-1.5 font-mono text-h3 text-amber">
                  {formatMoney(volume.runningTotal, volume.currency)}
                </dd>
              </div>
            </dl>
          </div>
        </CardBody>
      </Card>

      <div className="mt-8 flex flex-wrap items-baseline justify-between gap-4">
        <h2 className="font-display text-h3 font-medium text-ink">Raised invoices</h2>
        {outstanding > 0 ? (
          <p className="font-mono text-eyebrow uppercase tracking-[0.14em] text-muted">
            {formatMoney(outstanding)} outstanding
          </p>
        ) : null}
      </div>

      <Card className="mt-3 overflow-hidden">
        {issued.length === 0 ? (
          <EmptyState
            title="No invoices yet"
            description="Your first invoice is raised at the end of the month and will appear here with a PDF to download."
          />
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <Th>Invoice</Th>
                <Th>Period</Th>
                <Th align="right">Appointments</Th>
                <Th align="right">Total</Th>
                <Th>Status</Th>
                <Th>Due</Th>
                <Th align="right">PDF</Th>
              </tr>
            </thead>
            <tbody>
              {issued.map((invoice) => (
                <Tr key={invoice.id}>
                  <Td>
                    <span className="font-mono text-micro text-ink">{invoice.number}</span>
                  </Td>
                  <Td>
                    <span className="text-sm text-ink">{formatPeriod(invoice.period)}</span>
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
                    <PartnerInvoiceRow status={invoice.status} number={invoice.number} statusOnly />
                  </Td>
                  <Td>
                    <span className="font-mono text-micro text-muted">
                      {invoice.dueAt ? formatDate(invoice.dueAt, VIEW_TZ) : '—'}
                    </span>
                  </Td>
                  <Td align="right">
                    <PartnerInvoiceRow status={invoice.status} number={invoice.number} />
                  </Td>
                </Tr>
              ))}
            </tbody>
          </TableWrap>
        )}
      </Card>

      <p className="mt-6 max-w-2xl text-micro leading-relaxed text-muted">
        Every invoice is the number of appointments you sent multiplied by your agreed rate.
        Cancelled appointments are excluded. If a total looks wrong, reply to the invoice email and
        we will go through it line by line.
      </p>
    </PartnerShell>
  );
}
