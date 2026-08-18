import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getPartner } from '@/lib/data/client';
import { getBooking } from '@/lib/api/admin';
import { requireSession } from '@/lib/auth/session';
import {
  formatDate,
  formatDateTime,
  formatMoney,
  formatTime,
  timezoneAbbreviation,
  timezoneLabel,
} from '@/lib/format';
import { AdminShell } from '@/components/admin/AdminShell';
import { BookingActions } from '@/components/admin/BookingActions';
import { Card, CardBody, CardHeader, DataRow } from '@/components/ui/Card';
import { BookingStatusBadge, ChannelBadge, PaymentStatusBadge } from '@/components/ui/Badge';

export const metadata: Metadata = {
  title: 'Booking detail',
  robots: { index: false, follow: false },
};

const VIEW_TZ = 'Europe/London';

export default async function BookingDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: Record<string, string>;
}) {
  const session = await requireSession('admin', `/admin/bookings/${params.id}`);
  const isDoctor = session.role === 'doctor';

  const bookingRes = await getBooking(params.id);
  if (!bookingRes.success) notFound();
  const booking = bookingRes.data;

  const partnerRes = booking.partnerId ? await getPartner(booking.partnerId) : null;
  const partner = partnerRes?.success ? partnerRes.data : null;

  // Returning to the list restores the filters the admin arrived with.
  const query = new URLSearchParams(searchParams).toString();
  const backHref = `/admin/bookings${query ? `?${query}` : ''}`;

  return (
    <AdminShell
      user={session}
      crumbs={[
        { label: 'Admin', href: '/admin' },
        { label: 'Bookings', href: backHref },
        { label: booking.reference },
      ]}
      title={booking.patientName}
      description={`${formatDate(booking.startsAt, VIEW_TZ)} · ${formatTime(booking.startsAt, VIEW_TZ)}–${formatTime(booking.endsAt, VIEW_TZ)} ${timezoneLabel(VIEW_TZ)}`}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <BookingStatusBadge status={booking.status} />
          {!isDoctor ? <PaymentStatusBadge status={booking.paymentStatus} /> : null}
        </div>
      }
    >
      <Link
        href={backHref}
        className="inline-block text-micro text-muted underline decoration-line underline-offset-4 transition-colors hover:text-ink"
      >
        ← Back to bookings
      </Link>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="grid gap-6">
          {/* Intake is what the doctor actually opens this screen for. */}
          <Card>
            <CardHeader
              title="Patient intake"
              description="Answered before the appointment, read by the doctor beforehand."
            />
            <CardBody>
              <dl className="grid gap-0">
                {booking.intake.map((answer) => (
                  <div key={answer.question} className="border-b border-line py-4 last:border-0">
                    <dt className="text-micro text-muted">{answer.question}</dt>
                    <dd className="mt-1.5 text-base leading-relaxed text-ink">{answer.answer}</dd>
                  </div>
                ))}
              </dl>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Appointment" />
            <CardBody>
              <dl>
                <DataRow label="Starts" mono>
                  {formatDateTime(booking.startsAt, VIEW_TZ)} {timezoneAbbreviation(VIEW_TZ, booking.startsAt)}
                </DataRow>
                <DataRow label="Ends" mono>
                  {formatDateTime(booking.endsAt, VIEW_TZ)}
                </DataRow>
                <DataRow label="Patient’s local time" mono>
                  {formatDateTime(booking.startsAt, booking.patientTimezone)} ·{' '}
                  {timezoneLabel(booking.patientTimezone)}
                </DataRow>
                <DataRow label="Booked" mono>
                  {formatDateTime(booking.createdAt, VIEW_TZ)}
                </DataRow>
                <DataRow label="Reference" mono>
                  {booking.reference}
                </DataRow>
                {!isDoctor ? (
                  <DataRow label="Scheduling core id" mono>
                    {booking.externalBookingId}
                  </DataRow>
                ) : null}
              </dl>
            </CardBody>
          </Card>

          {booking.cancellationReason ? (
            <Card className="border-danger/25">
              <CardHeader title="Cancellation" />
              <CardBody>
                <p className="text-sm leading-relaxed text-ink">{booking.cancellationReason}</p>
                {booking.cancelledAt ? (
                  <p className="mt-2 font-mono text-eyebrow uppercase tracking-[0.14em] text-muted">
                    Cancelled {formatDateTime(booking.cancelledAt, VIEW_TZ)}
                  </p>
                ) : null}
              </CardBody>
            </Card>
          ) : null}
        </div>

        <div className="grid gap-6">
          <Card>
            <CardHeader title="Contact" />
            <CardBody>
              <dl>
                <DataRow label="Name">{booking.patientName}</DataRow>
                <DataRow label="Email" mono>
                  <a
                    href={`mailto:${booking.patientEmail}`}
                    className="underline decoration-line underline-offset-4 hover:decoration-accent"
                  >
                    {booking.patientEmail}
                  </a>
                </DataRow>
                <DataRow label="Phone" mono>
                  {booking.patientPhone}
                </DataRow>
                <DataRow label="Time zone" mono>
                  {booking.patientTimezone}
                </DataRow>
              </dl>
            </CardBody>
          </Card>

          {/* Commercial detail is administrator-only. */}
          {!isDoctor ? (
            <Card>
              <CardHeader title="Source and payment" />
              <CardBody>
                <dl>
                  <DataRow label="Source">
                    <ChannelBadge channel={booking.channel} partnerName={partner?.name} />
                  </DataRow>
                  {partner ? (
                    <>
                      <DataRow label="Partner rate" mono>
                        {formatMoney(partner.ratePerAppointment, partner.currency)} per appointment
                      </DataRow>
                      <DataRow label="Partner record">
                        <Link
                          href={`/admin/partners/${partner.id}`}
                          className="underline decoration-line underline-offset-4 hover:decoration-accent"
                        >
                          {partner.name}
                        </Link>
                      </DataRow>
                    </>
                  ) : null}
                  <DataRow label="Payment">
                    <PaymentStatusBadge status={booking.paymentStatus} />
                  </DataRow>
                  <DataRow label="Amount" mono>
                    {booking.amountPaid === null
                      ? 'Taken by the partner'
                      : formatMoney(booking.amountPaid, booking.currency)}
                  </DataRow>
                </dl>
                {booking.channel === 'partner' ? (
                  <p className="mt-4 rounded border border-line bg-paper-deep px-4 py-3 text-micro leading-relaxed text-muted">
                    The patient paid {partner?.name ?? 'the partner'} directly. This appointment is
                    counted towards their monthly invoice rather than collected here.
                  </p>
                ) : null}
              </CardBody>
            </Card>
          ) : null}

          <BookingActions
            bookingId={booking.id}
            reference={booking.reference}
            status={booking.status}
            canManage={!isDoctor}
            refundStatus={booking.refundStatus}
            refundAmount={booking.refundAmount}
            refundDeclineReason={booking.refundDeclineReason}
            currency={booking.currency}
          />
        </div>
      </div>
    </AdminShell>
  );
}
