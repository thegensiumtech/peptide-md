import type { Metadata } from 'next';
import Link from 'next/link';
import type { BookingChannel, BookingStatus } from '@peptide/shared';
import { getPartners } from '@/lib/data/client';
import { getBookings } from '@/lib/api/admin';
import { requireSession } from '@/lib/auth/session';
import { formatDate, formatMoney, formatTime, timezoneLabel } from '@/lib/format';
import { AdminShell } from '@/components/admin/AdminShell';
import { BookingFilters } from '@/components/admin/BookingFilters';
import { Card } from '@/components/ui/Card';
import { BookingStatusBadge, ChannelBadge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { TableWrap, Td, Th, Tr } from '@/components/ui/Table';

export const metadata: Metadata = {
  title: 'Bookings',
  robots: { index: false, follow: false },
};

const VIEW_TZ = 'Europe/London';

interface SearchParams {
  channel?: string;
  status?: string;
  partner?: string;
  from?: string;
  to?: string;
  q?: string;
}

export default async function BookingsPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await requireSession('admin', '/admin/bookings');
  const isDoctor = session.role === 'doctor';

  const [bookingsRes, partnersRes] = await Promise.all([
    getBookings({
      channel: (searchParams.channel as BookingChannel) ?? 'all',
      status: (searchParams.status as BookingStatus) ?? 'all',
      partnerId: searchParams.partner,
      from: searchParams.from,
      to: searchParams.to,
      search: searchParams.q,
      limit: 100,
    }),
    getPartners(),
  ]);

  if (!bookingsRes.success || !partnersRes.success) throw new Error('Bookings unavailable');

  const bookings = bookingsRes.data;
  const partners = partnersRes.data;
  const partnerNames = Object.fromEntries(partners.map((p) => [p.id, p.name]));

  // Carried into each row link so returning from a detail screen lands back on
  // the same filtered view.
  const query = new URLSearchParams(
    Object.entries(searchParams).filter(([, v]) => Boolean(v)) as [string, string][]
  ).toString();

  return (
    <AdminShell
      user={session}
      crumbs={[{ label: 'Admin', href: '/admin' }, { label: 'Bookings' }]}
      title="Bookings"
      description={
        isDoctor
          ? 'Every appointment in your diary, with what each patient wants to discuss.'
          : 'Every appointment, where it came from, and what state it is in.'
      }
    >
      <BookingFilters partners={partners} showChannel={!isDoctor} />

      <div className="mt-4 flex items-baseline justify-between gap-4">
        <p className="font-mono text-eyebrow uppercase tracking-[0.14em] text-muted">
          {bookingsRes.meta?.total ?? bookings.length} booking
          {(bookingsRes.meta?.total ?? bookings.length) === 1 ? '' : 's'}
        </p>
        <p className="font-mono text-eyebrow uppercase tracking-[0.14em] text-muted">
          Times in {timezoneLabel(VIEW_TZ)}
        </p>
      </div>

      <Card className="mt-3 overflow-hidden">
        {bookings.length === 0 ? (
          <EmptyState
            title="No bookings match those filters"
            description="Try widening the date range or clearing the source and status filters."
          />
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <Th>When</Th>
                <Th>Patient</Th>
                <Th>Reference</Th>
                {!isDoctor ? <Th>Source</Th> : null}
                <Th>Status</Th>
                {!isDoctor ? <Th align="right">Paid</Th> : null}
              </tr>
            </thead>
            <tbody>
              {bookings.map((booking) => (
                <Tr key={booking.id}>
                  <Td className="whitespace-nowrap">
                    <Link
                      href={`/admin/bookings/${booking.id}${query ? `?${query}` : ''}`}
                      className="block"
                    >
                      <span className="block font-mono text-sm text-ink">
                        {formatDate(booking.startsAt, VIEW_TZ)}
                      </span>
                      <span className="mt-0.5 block font-mono text-eyebrow text-muted">
                        {formatTime(booking.startsAt, VIEW_TZ)}
                      </span>
                    </Link>
                  </Td>
                  <Td>
                    <Link
                      href={`/admin/bookings/${booking.id}${query ? `?${query}` : ''}`}
                      className="block max-w-64"
                    >
                      <span className="block truncate text-sm font-medium text-ink">
                        {booking.patientName}
                      </span>
                      <span className="mt-0.5 block truncate text-micro text-muted">
                        {timezoneLabel(booking.patientTimezone)}
                      </span>
                    </Link>
                  </Td>
                  <Td>
                    <span className="font-mono text-micro text-muted">{booking.reference}</span>
                  </Td>
                  {!isDoctor ? (
                    <Td>
                      <ChannelBadge
                        channel={booking.channel}
                        partnerName={booking.partnerId ? partnerNames[booking.partnerId] : null}
                      />
                    </Td>
                  ) : null}
                  <Td>
                    <BookingStatusBadge status={booking.status} />
                  </Td>
                  {!isDoctor ? (
                    <Td align="right">
                      <span className="font-mono text-sm text-ink">
                        {booking.amountPaid === null
                          ? '—'
                          : formatMoney(booking.amountPaid, booking.currency)}
                      </span>
                    </Td>
                  ) : null}
                </Tr>
              ))}
            </tbody>
          </TableWrap>
        )}
      </Card>

      {!isDoctor ? (
        <p className="mt-4 max-w-2xl text-micro leading-relaxed text-muted">
          A dash in the paid column means the appointment came through a partner — the patient paid
          that partner directly, and the appointment is billed to them at month end instead.
        </p>
      ) : null}
    </AdminShell>
  );
}
