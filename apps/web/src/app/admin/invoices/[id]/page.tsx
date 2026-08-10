import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getInvoice, getInvoiceBookings } from '@/lib/data/client';
import { requirePermission, requireSession } from '@/lib/auth/session';
import { formatDate, formatMoney, formatPeriod, formatTime, timezoneLabel } from '@/lib/format';
import { AdminShell } from '@/components/admin/AdminShell';
import { InvoiceActions } from '@/components/admin/InvoiceActions';
import { Card, CardBody, CardHeader, DataRow } from '@/components/ui/Card';
import { InvoiceStatusBadge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { TableWrap, Td, Th, Tr } from '@/components/ui/Table';

export const metadata: Metadata = {
  title: 'Invoice detail',
  robots: { index: false, follow: false },
};

const VIEW_TZ = 'Europe/London';

export default async function InvoiceDetailPage({ params }: { params: { id: string } }) {
  const session = await requireSession('admin', `/admin/invoices/${params.id}`);
  requirePermission(session, 'invoices.manage');

  const invoiceRes = await getInvoice(params.id);
  if (!invoiceRes.success) notFound();
  const invoice = invoiceRes.data;

  const bookingsRes = await getInvoiceBookings(invoice.id);
  const bookings = bookingsRes.success ? bookingsRes.data : [];

  return (
    <AdminShell
      user={session}
      crumbs={[
        { label: 'Admin', href: '/admin' },
        { label: 'Invoices', href: '/admin/invoices' },
        { label: invoice.number },
      ]}
      title={invoice.partnerName}
      description={`${formatPeriod(invoice.period)} · ${invoice.appointmentCount} appointment${invoice.appointmentCount === 1 ? '' : 's'} at ${formatMoney(invoice.ratePerAppointment, invoice.currency)}`}
      actions={<InvoiceStatusBadge status={invoice.status} />}
    >
      <Link
        href="/admin/invoices"
        className="inline-block text-micro text-muted underline decoration-line underline-offset-4 transition-colors hover:text-ink"
      >
        ← Back to invoices
      </Link>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="grid gap-6">
          {/* The appointments behind the total. This is what makes the number
              checkable rather than something to be taken on trust. */}
          <Card>
            <CardHeader
              title="Appointments in this invoice"
              description="Every appointment counted towards the total. Open one to see the booking."
            />
            {bookings.length === 0 ? (
              <EmptyState
                title="Line detail not itemised"
                description="This invoice predates per-appointment line storage, so it is summarised by count. Invoices raised from now on itemise every appointment."
              />
            ) : (
              <TableWrap>
                <thead>
                  <tr>
                    <Th>Date</Th>
                    <Th>Reference</Th>
                    <Th>Patient</Th>
                    <Th align="right">Charge</Th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.map((booking) => (
                    <Tr key={booking.id}>
                      <Td className="whitespace-nowrap">
                        <Link href={`/admin/bookings/${booking.id}`} className="block">
                          <span className="block font-mono text-sm text-ink">
                            {formatDate(booking.startsAt, VIEW_TZ)}
                          </span>
                          <span className="mt-0.5 block font-mono text-eyebrow text-muted">
                            {formatTime(booking.startsAt, VIEW_TZ)} {timezoneLabel(VIEW_TZ)}
                          </span>
                        </Link>
                      </Td>
                      <Td>
                        <Link
                          href={`/admin/bookings/${booking.id}`}
                          className="font-mono text-micro text-ink underline decoration-line underline-offset-4 hover:decoration-accent"
                        >
                          {booking.reference}
                        </Link>
                      </Td>
                      <Td>
                        <span className="text-sm text-ink">{booking.patientName}</span>
                      </Td>
                      <Td align="right">
                        <span className="font-mono text-sm text-ink">
                          {formatMoney(invoice.ratePerAppointment, invoice.currency)}
                        </span>
                      </Td>
                    </Tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <Td className="border-0 font-medium" />
                    <Td className="border-0" />
                    <Td className="border-0 text-right font-medium text-ink">Total</Td>
                    <Td align="right" className="border-0">
                      <span className="font-mono text-base font-semibold text-accent">
                        {formatMoney(invoice.totalAmount, invoice.currency)}
                      </span>
                    </Td>
                  </tr>
                </tfoot>
              </TableWrap>
            )}
          </Card>
        </div>

        <div className="grid gap-6">
          <Card>
            <CardHeader title="Invoice" />
            <CardBody>
              <dl>
                <DataRow label="Number" mono>
                  {invoice.number}
                </DataRow>
                <DataRow label="Partner">
                  <Link
                    href={`/admin/partners/${invoice.partnerId}`}
                    className="underline decoration-line underline-offset-4 hover:decoration-accent"
                  >
                    {invoice.partnerName}
                  </Link>
                </DataRow>
                <DataRow label="Period">{formatPeriod(invoice.period)}</DataRow>
                <DataRow label="Appointments" mono>
                  {invoice.appointmentCount}
                </DataRow>
                <DataRow label="Rate" mono>
                  {formatMoney(invoice.ratePerAppointment, invoice.currency)} each
                </DataRow>
                <DataRow label="Total" mono>
                  <span className="font-semibold text-accent">
                    {formatMoney(invoice.totalAmount, invoice.currency)}
                  </span>
                </DataRow>
                <DataRow label="Issued" mono>
                  {invoice.issuedAt ? formatDate(invoice.issuedAt, VIEW_TZ) : 'Not yet raised'}
                </DataRow>
                <DataRow label="Due" mono>
                  {invoice.dueAt ? formatDate(invoice.dueAt, VIEW_TZ) : '—'}
                </DataRow>
                <DataRow label="Paid" mono>
                  {invoice.paidAt ? formatDate(invoice.paidAt, VIEW_TZ) : '—'}
                </DataRow>
              </dl>
            </CardBody>
          </Card>

          <InvoiceActions
            number={invoice.number}
            status={invoice.status}
            partnerName={invoice.partnerName}
            hasPdf={Boolean(invoice.pdfUrl)}
          />
        </div>
      </div>
    </AdminShell>
  );
}
