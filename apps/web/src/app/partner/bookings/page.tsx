import type { Metadata } from 'next';
import Link from 'next/link';
import { getPartnerBookings, getPartnerMe, toPartner } from '@/lib/api/partner';
import { requirePartnerId, requireSession } from '@/lib/auth/session';
import { CURRENT_PERIOD } from '@/lib/clock';
import { formatDate, formatMoney, formatPeriod, formatTime, timezoneLabel } from '@/lib/format';
import { PartnerShell } from '@/components/partner/PartnerShell';
import { StatTile } from '@/components/admin/StatTile';
import { Card } from '@/components/ui/Card';
import { BookingStatusBadge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { TableWrap, Td, Th, Tr } from '@/components/ui/Table';

export const metadata: Metadata = {
  title: 'Your bookings',
  robots: { index: false, follow: false },
};

const VIEW_TZ = 'Europe/London';

export default async function PartnerBookingsPage() {
  const session = await requireSession('partner', '/partner/bookings');
  // Confirms this really is a partner session; the API reads the id from the
  // token itself, so it is never sent from here.
  requirePartnerId(session);

  const [meRes, bookingsRes] = await Promise.all([getPartnerMe(), getPartnerBookings()]);

  if (!meRes.success || !bookingsRes.success) {
    throw new Error('Partner data unavailable');
  }

  const partner = toPartner(meRes.data);
  const volume = meRes.data.volume;
  const bookings = bookingsRes.data;
  const upcoming = bookings.filter((b) => b.status === 'confirmed').length;

  return (
    <PartnerShell
      user={session}
      partner={partner}
      title="Your bookings"
      description={`Every appointment you have sent to Dr Hartley, and what you owe so far this month.`}
    >
      {/* The running total is the number this screen exists to answer. */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile
          label={`${formatPeriod(CURRENT_PERIOD)} so far`}
          value={String(volume.appointmentCount)}
          detail="Billable appointments sent"
        />
        <StatTile
          label="Your rate"
          value={formatMoney(volume.ratePerAppointment, volume.currency)}
          detail="Per appointment, agreed with Peptide MD"
        />
        <StatTile
          label="Running total"
          value={formatMoney(volume.runningTotal, volume.currency)}
          detail="Invoiced at the end of the month"
          tone="accent"
          href="/partner/invoices"
        />
      </div>

      <div className="mt-8 flex flex-wrap items-baseline justify-between gap-4">
        <p className="font-mono text-eyebrow uppercase tracking-[0.14em] text-muted">
          {bookings.length} appointment{bookings.length === 1 ? '' : 's'} · {upcoming} upcoming
        </p>
        <p className="font-mono text-eyebrow uppercase tracking-[0.14em] text-muted">
          Times in {timezoneLabel(VIEW_TZ)}
        </p>
      </div>

      <Card className="mt-3 overflow-hidden">
        {bookings.length === 0 ? (
          <EmptyState
            title="No appointments yet"
            description="Once a patient books through your site, the appointment appears here within seconds."
            action={
              <Link
                href="/partner/api-credentials"
                className="link-cta text-micro text-ink underline decoration-line underline-offset-4"
              >
                View your integration details
              </Link>
            }
          />
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <Th>When</Th>
                <Th>Patient</Th>
                <Th>Reference</Th>
                <Th>Status</Th>
                <Th align="right">Charge</Th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((booking) => (
                <Tr key={booking.id}>
                  <Td className="whitespace-nowrap">
                    <span className="block font-mono text-sm text-ink">
                      {formatDate(booking.startsAt, VIEW_TZ)}
                    </span>
                    <span className="mt-0.5 block font-mono text-eyebrow text-muted">
                      {formatTime(booking.startsAt, VIEW_TZ)}
                    </span>
                  </Td>
                  <Td>
                    <span className="text-sm text-ink">{booking.patientName}</span>
                  </Td>
                  <Td>
                    <span className="font-mono text-micro text-muted">{booking.reference}</span>
                  </Td>
                  <Td>
                    <BookingStatusBadge status={booking.status} />
                  </Td>
                  <Td align="right">
                    <span className="font-mono text-sm text-ink">
                      {booking.status === 'cancelled'
                        ? ', '
                        : formatMoney(partner.ratePerAppointment, partner.currency)}
                    </span>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </TableWrap>
        )}
      </Card>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <p className="rounded border border-line bg-surface px-5 py-4 text-micro leading-relaxed text-muted">
          Cancelled appointments are not billed. They stay listed so your own records reconcile
          against ours.
        </p>
        <p className="rounded border border-line bg-surface px-5 py-4 text-micro leading-relaxed text-muted">
          You see the patient’s name and the appointment status. What the patient discussed with
          the doctor is confidential and is never shown here.
        </p>
      </div>
    </PartnerShell>
  );
}
