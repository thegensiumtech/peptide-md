import type { Metadata } from 'next';
import Link from 'next/link';
import { getVolumeReport } from '@/lib/api/admin';
import { requirePermission, requireSession } from '@/lib/auth/session';
import { formatMoney, formatPeriod } from '@/lib/format';
import { AdminShell } from '@/components/admin/AdminShell';
import { ReportPeriodFilter } from '@/components/admin/ReportPeriodFilter';
import { VolumeChart } from '@/components/admin/VolumeChart';
import { StatTile } from '@/components/admin/StatTile';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { TableWrap, Td, Th, Tr } from '@/components/ui/Table';

export const metadata: Metadata = {
  title: 'Reports',
  robots: { index: false, follow: false },
};

/**
 * Volume by source, by partner and by period.
 *
 * The dashboard answers how this month is going. This answers how the months
 * have gone, which is the question behind renegotiating a partner rate or
 * deciding whether the partner channel is worth the work.
 *
 * Every figure here excludes sandbox bookings and cancellations, so it
 * reconciles with the invoices rather than sitting slightly above them, which
 * would be worse than no report at all.
 */
export default async function ReportsPage({
  searchParams,
}: {
  searchParams: { from?: string; to?: string };
}) {
  const session = await requireSession('admin', '/admin/reports');
  // Reporting is commercial data, gated with the same permission as invoices
  // rather than a parallel one that would map to exactly the same roles.
  requirePermission(session, 'invoices.manage');

  const reportRes = await getVolumeReport({ from: searchParams.from, to: searchParams.to });
  if (!reportRes.success) throw new Error('Report unavailable');
  const report = reportRes.data;

  // Two years of months to choose between, ending at the current one. Built
  // from today rather than from the data so an empty month is still selectable.
  const periodOptions = (() => {
    const options: { value: string; label: string }[] = [];
    const now = new Date();
    let year = now.getUTCFullYear();
    let month = now.getUTCMonth() + 1;
    for (let i = 0; i < 24; i += 1) {
      const value = `${year}-${String(month).padStart(2, '0')}`;
      options.unshift({ value, label: formatPeriod(value) });
      month -= 1;
      if (month === 0) {
        month = 12;
        year -= 1;
      }
    }
    return options;
  })();

  // One row per partner across the whole window, which is the reading that
  // matters for a rate conversation. The per period detail stays below it.
  const partnerTotals = new Map<
    string,
    { partnerId: string; partnerName: string; appointmentCount: number; billableAmount: number }
  >();
  for (const row of report.byPartner) {
    const existing = partnerTotals.get(row.partnerId);
    if (existing) {
      existing.appointmentCount += row.appointmentCount;
      existing.billableAmount += row.billableAmount ?? 0;
    } else {
      partnerTotals.set(row.partnerId, {
        partnerId: row.partnerId,
        partnerName: row.partnerName,
        appointmentCount: row.appointmentCount,
        billableAmount: row.billableAmount ?? 0,
      });
    }
  }
  const partnerRows = [...partnerTotals.values()].sort(
    (a, b) => b.appointmentCount - a.appointmentCount
  );

  const partnerShare =
    report.totals.total === 0
      ? 0
      : Math.round((report.totals.partner / report.totals.total) * 100);

  const windowLabel =
    report.from === report.to
      ? formatPeriod(report.from)
      : `${formatPeriod(report.from)} to ${formatPeriod(report.to)}`;

  return (
    <AdminShell
      user={session}
      crumbs={[{ label: 'Admin', href: '/admin' }, { label: 'Reports' }]}
      title="Reports"
      description="Where the appointments came from, month by month. Cancellations and sandbox traffic are excluded, so these figures reconcile with the invoices."
    >
      <ReportPeriodFilter from={report.from} to={report.to} options={periodOptions} />

      <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Appointments"
          value={String(report.totals.total)}
          detail={windowLabel}
        />
        <StatTile
          label="Through partners"
          value={String(report.totals.partner)}
          detail={`${partnerShare}% of the total`}
          tone="accent"
        />
        <StatTile
          label="Direct revenue"
          value={formatMoney(report.totals.directRevenue, report.currency)}
          detail="Taken through Stripe"
        />
        <StatTile
          label="Billed to partners"
          value={formatMoney(report.totals.billableAmount, report.currency)}
          detail="At the rate each invoice captured"
          tone="signal"
        />
      </section>

      <Card className="mt-6">
        <CardHeader title="Volume by source" description={windowLabel} />
        <CardBody>
          {report.totals.total === 0 ? (
            <EmptyState
              title="No appointments in this window"
              description="Nothing was booked between these months. Widen the range to see history."
            />
          ) : (
            <VolumeChart data={report.bySource} />
          )}
        </CardBody>
      </Card>

      <Card className="mt-6 overflow-hidden">
        <CardHeader
          title="By partner"
          description="Across the whole window. Open a partner to see their rate and credentials."
        />
        {partnerRows.length === 0 ? (
          <EmptyState
            title="No partner appointments in this window"
            description="Every appointment in these months came through the website directly."
          />
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <Th>Partner</Th>
                <Th align="right">Appointments</Th>
                <Th align="right">Share of partner volume</Th>
                <Th align="right">Billed</Th>
              </tr>
            </thead>
            <tbody>
              {partnerRows.map((row) => (
                <Tr key={row.partnerId}>
                  <Td>
                    <Link
                      href={`/admin/partners/${row.partnerId}`}
                      className="text-ink underline decoration-line underline-offset-4 transition-colors hover:decoration-ink"
                    >
                      {row.partnerName}
                    </Link>
                  </Td>
                  <Td align="right" className="font-mono">
                    {row.appointmentCount}
                  </Td>
                  <Td align="right" className="font-mono text-muted">
                    {report.totals.partner === 0
                      ? '–'
                      : `${Math.round((row.appointmentCount / report.totals.partner) * 100)}%`}
                  </Td>
                  <Td align="right" className="font-mono">
                    {formatMoney(row.billableAmount, report.currency)}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </TableWrap>
        )}
      </Card>

      {report.byPartner.length > 0 ? (
        <Card className="mt-6 overflow-hidden">
          <CardHeader
            title="By partner and month"
            description="The same figures broken out per period, which is what an invoice query usually comes down to."
          />
          <TableWrap>
            <thead>
              <tr>
                <Th>Month</Th>
                <Th>Partner</Th>
                <Th align="right">Appointments</Th>
                <Th align="right">Billed</Th>
              </tr>
            </thead>
            <tbody>
              {report.byPartner.map((row) => (
                <Tr key={`${row.partnerId}:${row.period}`}>
                  <Td className="whitespace-nowrap">{formatPeriod(row.period)}</Td>
                  <Td>{row.partnerName}</Td>
                  <Td align="right" className="font-mono">
                    {row.appointmentCount}
                  </Td>
                  <Td align="right" className="font-mono">
                    {row.billableAmount === null
                      ? '–'
                      : formatMoney(row.billableAmount, report.currency)}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </TableWrap>
        </Card>
      ) : null}

      <p className="mt-4 max-w-2xl text-micro leading-relaxed text-muted">
        A period that has already been invoiced is priced at the rate that invoice captured, so
        changing a partner rate today never restates a month that has been billed. A dash means the
        period has no invoice and the partner has no rate on record.
      </p>
    </AdminShell>
  );
}
