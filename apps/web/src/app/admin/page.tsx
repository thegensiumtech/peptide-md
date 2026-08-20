import type { Metadata } from 'next';
import Link from 'next/link';
import { can } from '@peptide/shared';
import { getAllPartnerVolumes } from '@/lib/data/client';
import { getDashboard, getUpcomingBookings } from '@/lib/api/admin';
import { requireSession } from '@/lib/auth/session';
import { CURRENT_PERIOD } from '@/lib/clock';
import { formatDate, formatMoney, formatPeriod, formatRelativeDay, formatTime } from '@/lib/format';
import { AdminShell } from '@/components/admin/AdminShell';
import { StatTile } from '@/components/admin/StatTile';
import { VolumeChart } from '@/components/admin/VolumeChart';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { ButtonLink } from '@/components/ui/Button';
import { ChannelBadge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';

export const metadata: Metadata = {
  title: 'Dashboard',
  robots: { index: false, follow: false },
};

const DOCTOR_TZ = 'Europe/London';

export default async function AdminDashboardPage() {
  const session = await requireSession('admin', '/admin');
  const isDoctor = session.role === 'doctor';

  const [dashboardRes, upcomingRes, volumesRes] = await Promise.all([
    getDashboard(),
    getUpcomingBookings({ limit: 8 }),
    getAllPartnerVolumes(),
  ]);

  if (!dashboardRes.success || !upcomingRes.success || !volumesRes.success) {
    throw new Error('Dashboard data unavailable');
  }

  const summary = dashboardRes.data;
  const upcoming = upcomingRes.data;
  // Only partners who actually sent something this month belong on the tile row.
  const activeVolumes = volumesRes.data.filter((v) => v.appointmentCount > 0);

  return (
    <AdminShell
      user={session}
      title={isDoctor ? `Good morning, ${session.name.split(' ').slice(-1)[0]}.` : 'Dashboard'}
      description={
        isDoctor
          ? 'Your upcoming appointments, and what each patient wants to talk about.'
          : `Volume, revenue and partner billing for ${formatPeriod(CURRENT_PERIOD)}.`
      }
      actions={
        <ButtonLink href="/admin/bookings" variant="secondary" size="sm">
          All bookings
        </ButtonLink>
      }
    >
      {/* Doctors see a diary. Administrators see a business. */}
      {isDoctor ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <StatTile label="Upcoming" value={String(summary.upcomingCount)} detail="Confirmed appointments ahead" />
          <StatTile
            label={`Seen in ${formatPeriod(CURRENT_PERIOD).split(' ')[0]}`}
            value={String(summary.monthVolume.total)}
            detail="Across both channels"
          />
          <StatTile label="Next appointment" value={upcoming[0] ? formatTime(upcoming[0].startsAt, DOCTOR_TZ) : ', '} detail={upcoming[0] ? formatDate(upcoming[0].startsAt, DOCTOR_TZ) : 'Nothing booked'} />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile label="Upcoming" value={String(summary.upcomingCount)} detail="Confirmed appointments ahead" href="/admin/bookings?status=confirmed" />
          <StatTile
            label={`Booked in ${formatPeriod(CURRENT_PERIOD).split(' ')[0]}`}
            value={String(summary.monthVolume.total)}
            detail={`${summary.monthVolume.direct} direct · ${summary.monthVolume.partner} partner`}
          />
          <StatTile
            label="Direct revenue"
            value={formatMoney(summary.directRevenueThisMonth, summary.currency)}
            detail="Taken through Stripe this month"
            tone="signal"
          />
          <StatTile
            label="Billable to partners"
            value={formatMoney(summary.billableThisMonth, summary.currency)}
            detail="Raised as invoices at month end"
            tone="accent"
            href="/admin/invoices"
          />
        </div>
      )}

      <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        {/* Upcoming appointments */}
        <Card>
          <CardHeader
            title="Upcoming appointments"
            description={`Shown in ${DOCTOR_TZ.split('/')[1]} time`}
            action={
              <Link
                href="/admin/bookings"
                className="text-micro text-muted underline decoration-line underline-offset-4 transition-colors hover:text-ink"
              >
                View all
              </Link>
            }
          />
          {upcoming.length === 0 ? (
            <EmptyState
              title="Nothing in the diary"
              description="No confirmed appointments ahead. New bookings appear here the moment payment clears."
            />
          ) : (
            <ul className="divide-y divide-line">
              {upcoming.map((booking) => {
                const relative = formatRelativeDay(booking.startsAt, DOCTOR_TZ);
                return (
                  <li key={booking.id}>
                    <Link
                      href={`/admin/bookings/${booking.id}`}
                      className="flex items-start gap-4 px-5 py-4 transition-colors hover:bg-paper-deep/60"
                    >
                      <div className="w-20 shrink-0">
                        <p className="font-mono text-sm text-ink">
                          {formatTime(booking.startsAt, DOCTOR_TZ)}
                        </p>
                        <p className="mt-0.5 font-mono text-eyebrow uppercase tracking-[0.12em] text-muted">
                          {relative ?? formatDate(booking.startsAt, DOCTOR_TZ).replace(/ \d{4}$/, '')}
                        </p>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-ink">
                          {booking.patientName}
                        </p>
                        <p className="mt-0.5 truncate text-micro text-muted">
                          {booking.intake[0]?.answer}
                        </p>
                      </div>
                      {!isDoctor ? (
                        <ChannelBadge
                          channel={booking.channel}
                          partnerName={
                            activeVolumes.find((v) => v.partnerId === booking.partnerId)?.partnerName
                          }
                        />
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <div className="grid gap-6">
          {!isDoctor ? (
            <Card>
              <CardHeader title="Volume by source" description="Last six months" />
              <CardBody>
                <VolumeChart data={summary.volumeTrend} />
              </CardBody>
            </Card>
          ) : (
            <Card>
              <CardHeader title="Your week" description="Where your availability currently sits" />
              <CardBody>
                <p className="text-sm leading-relaxed text-muted">
                  Your weekly pattern and any one-off changes are managed on the availability
                  screen. A change there applies everywhere at once, this website and every
                  partner site.
                </p>
                <ButtonLink href="/admin/availability" variant="secondary" size="sm" className="mt-5">
                  Manage availability
                </ButtonLink>
              </CardBody>
            </Card>
          )}

          {/* Billable per partner, each tile leads to that partner's draft invoice. */}
          {can(session, 'invoices.manage') ? (
            <Card>
              <CardHeader
                title="Billable this month"
                description="Counted automatically, invoiced at month end"
                action={
                  <Link
                    href="/admin/invoices"
                    className="text-micro text-muted underline decoration-line underline-offset-4 transition-colors hover:text-ink"
                  >
                    Invoices
                  </Link>
                }
              />
              {activeVolumes.length === 0 ? (
                <EmptyState
                  title="No partner volume yet"
                  description="Once a partner sends their first appointment this month, their running total appears here."
                />
              ) : (
                <ul className="divide-y divide-line">
                  {activeVolumes.map((volume) => (
                    <li
                      key={volume.partnerId}
                      className="flex items-center justify-between gap-4 px-5 py-4"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-ink">
                          {volume.partnerName}
                        </p>
                        <p className="mt-0.5 font-mono text-eyebrow uppercase tracking-[0.12em] text-muted">
                          {volume.appointmentCount} ×{' '}
                          {formatMoney(volume.ratePerAppointment, volume.currency)}
                        </p>
                      </div>
                      <p className="shrink-0 font-mono text-sm text-accent">
                        {formatMoney(volume.runningTotal, volume.currency)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          ) : null}
        </div>
      </div>
    </AdminShell>
  );
}
