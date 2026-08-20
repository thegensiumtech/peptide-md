import type {
  ApiResponse,
  Availability,
  Booking,
  BookingFilters,
  DashboardSummary,
  DaySlots,
  DoctorProfile,
  Invoice,
  Partner,
  PartnerVolume,
  PlatformSettings,
  VolumeBySource,
} from '@peptide/shared';
import { ok, fail, isBillableToPartner } from '@peptide/shared';
import { CURRENT_PERIOD, NOW_ISO } from '@/lib/clock';
import { bookings } from './fixtures/bookings';
import { partners } from './fixtures/partners';
import { invoices } from './fixtures/invoices';
import { availability, doctorProfile } from './fixtures/doctor';
import { platformSettings } from './fixtures/settings';
import { availableDays } from './fixtures/slots';

/**
 * The data client.
 *
 * Every screen reads through these functions and nothing else. They are async
 * and return the same ApiResponse envelope the Express API will return, so
 * swapping static fixtures for real endpoints is a change to this file alone, * each function body becomes a fetch, and no screen changes.
 *
 * See docs/screen-map.md for the function-to-endpoint mapping.
 */

const DEFAULT_LIMIT = 25;

function partnerName(partnerId: string | null): string | null {
  if (!partnerId) return null;
  return partners.find((p) => p.id === partnerId)?.name ?? null;
}

// --- Bookings -------------------------------------------------------------

export async function getBookings(
  filters: BookingFilters = {}
): Promise<ApiResponse<Booking[]>> {
  const {
    channel = 'all',
    status = 'all',
    partnerId,
    from,
    to,
    search,
    page = 1,
    limit = DEFAULT_LIMIT,
  } = filters;

  let rows = [...bookings];

  if (channel !== 'all') rows = rows.filter((b) => b.channel === channel);
  if (status !== 'all') rows = rows.filter((b) => b.status === status);
  // Partner scoping is applied here, before anything is returned, the portal
  // never filters another partner's rows out on the client.
  if (partnerId) rows = rows.filter((b) => b.partnerId === partnerId);
  if (from) rows = rows.filter((b) => b.startsAt >= `${from}T00:00:00.000Z`);
  if (to) rows = rows.filter((b) => b.startsAt <= `${to}T23:59:59.999Z`);

  if (search) {
    const q = search.trim().toLowerCase();
    rows = rows.filter(
      (b) =>
        b.patientName.toLowerCase().includes(q) ||
        b.patientEmail.toLowerCase().includes(q) ||
        b.reference.toLowerCase().includes(q)
    );
  }

  rows.sort((a, b) => b.startsAt.localeCompare(a.startsAt));

  const total = rows.length;
  const start = (page - 1) * limit;
  return ok(rows.slice(start, start + limit), { total, page, limit });
}

export async function getBooking(id: string): Promise<ApiResponse<Booking>> {
  const booking = bookings.find((b) => b.id === id);
  if (!booking) return fail('Booking not found');
  return ok(booking);
}

/** Upcoming appointments from the anchor date forward, soonest first. */
export async function getUpcomingBookings(
  options: { partnerId?: string; limit?: number } = {}
): Promise<ApiResponse<Booking[]>> {
  const { partnerId, limit = 10 } = options;
  const rows = bookings
    .filter((b) => b.startsAt >= NOW_ISO && b.status === 'confirmed')
    .filter((b) => (partnerId ? b.partnerId === partnerId : true))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
    .slice(0, limit);
  return ok(rows);
}

// --- Dashboard ------------------------------------------------------------

function volumeForPeriod(period: string): VolumeBySource {
  const rows = bookings.filter(
    (b) => b.startsAt.startsWith(period) && b.status !== 'cancelled'
  );
  const direct = rows.filter((b) => b.channel === 'direct').length;
  const partner = rows.filter((b) => b.channel === 'partner').length;
  return { period, direct, partner, total: direct + partner };
}

export async function getDashboard(): Promise<ApiResponse<DashboardSummary>> {
  const monthVolume = volumeForPeriod(CURRENT_PERIOD);

  const billableThisMonth = bookings
    .filter((b) => b.startsAt.startsWith(CURRENT_PERIOD) && isBillableToPartner(b))
    .reduce((sum, b) => {
      const rate = partners.find((p) => p.id === b.partnerId)?.ratePerAppointment ?? 0;
      return sum + rate;
    }, 0);

  const directRevenueThisMonth = bookings
    .filter(
      (b) =>
        b.startsAt.startsWith(CURRENT_PERIOD) &&
        b.channel === 'direct' &&
        b.paymentStatus === 'paid'
    )
    .reduce((sum, b) => sum + (b.amountPaid ?? 0), 0);

  const upcomingCount = bookings.filter(
    (b) => b.startsAt >= NOW_ISO && b.status === 'confirmed'
  ).length;

  // Six-month trend. Earlier months predate the fixture bookings, so their
  // volume comes from the issued invoices, which is the same source the real
  // reporting screen would aggregate from.
  const trendPeriods = ['2026-03', '2026-04', '2026-05', '2026-06', '2026-07', CURRENT_PERIOD];
  const volumeTrend: VolumeBySource[] = trendPeriods.map((period) => {
    if (period === CURRENT_PERIOD) return monthVolume;
    const partner = invoices
      .filter((i) => i.period === period)
      .reduce((sum, i) => sum + i.appointmentCount, 0);
    const direct = { '2026-03': 9, '2026-04': 14, '2026-05': 18, '2026-06': 22, '2026-07': 25 }[
      period
    ] ?? 0;
    return { period, direct, partner, total: direct + partner };
  });

  return ok({
    upcomingCount,
    monthVolume,
    billableThisMonth,
    currency: 'GBP',
    directRevenueThisMonth,
    volumeTrend,
  });
}

// --- Partners -------------------------------------------------------------

export async function getPartners(): Promise<ApiResponse<Partner[]>> {
  return ok([...partners].sort((a, b) => a.name.localeCompare(b.name)));
}

export async function getPartner(id: string): Promise<ApiResponse<Partner>> {
  const partner = partners.find((p) => p.id === id);
  if (!partner) return fail('Partner not found');
  return ok(partner);
}

/** Running volume and value for one partner in the current period. */
export async function getPartnerVolume(
  partnerId: string,
  period: string = CURRENT_PERIOD
): Promise<ApiResponse<PartnerVolume>> {
  const partner = partners.find((p) => p.id === partnerId);
  if (!partner) return fail('Partner not found');

  const count = bookings.filter(
    (b) => b.partnerId === partnerId && b.startsAt.startsWith(period) && isBillableToPartner(b)
  ).length;

  return ok({
    partnerId,
    partnerName: partner.name,
    period,
    appointmentCount: count,
    ratePerAppointment: partner.ratePerAppointment,
    runningTotal: count * partner.ratePerAppointment,
    currency: partner.currency,
  });
}

export async function getAllPartnerVolumes(
  period: string = CURRENT_PERIOD
): Promise<ApiResponse<PartnerVolume[]>> {
  const volumes = await Promise.all(
    partners.map((p) => getPartnerVolume(p.id, period))
  );
  return ok(volumes.flatMap((v) => (v.success ? [v.data] : [])));
}

// --- Invoices -------------------------------------------------------------

export async function getInvoices(
  filters: { partnerId?: string; period?: string } = {}
): Promise<ApiResponse<Invoice[]>> {
  let rows = [...invoices];
  if (filters.partnerId) rows = rows.filter((i) => i.partnerId === filters.partnerId);
  if (filters.period) rows = rows.filter((i) => i.period === filters.period);
  rows.sort((a, b) => b.period.localeCompare(a.period) || a.partnerName.localeCompare(b.partnerName));
  return ok(rows);
}

export async function getInvoice(id: string): Promise<ApiResponse<Invoice>> {
  const invoice = invoices.find((i) => i.id === id);
  if (!invoice) return fail('Invoice not found');
  return ok(invoice);
}

/** The appointments counted into an invoice, the evidence behind the total. */
export async function getInvoiceBookings(id: string): Promise<ApiResponse<Booking[]>> {
  const invoice = invoices.find((i) => i.id === id);
  if (!invoice) return fail('Invoice not found');
  const rows = bookings
    .filter((b) => invoice.bookingIds.includes(b.id))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  return ok(rows);
}

// --- Doctor, availability, settings ---------------------------------------

export async function getDoctorProfile(): Promise<ApiResponse<DoctorProfile>> {
  return ok(doctorProfile);
}

export async function getAvailability(): Promise<ApiResponse<Availability>> {
  return ok(availability);
}

export async function getAvailableDays(): Promise<ApiResponse<DaySlots[]>> {
  return ok(availableDays);
}

export async function getSettings(): Promise<ApiResponse<PlatformSettings>> {
  return ok(platformSettings);
}

// --- Lookups --------------------------------------------------------------

export async function getPartnerNameMap(): Promise<ApiResponse<Record<string, string>>> {
  return ok(Object.fromEntries(partners.map((p) => [p.id, p.name])));
}

export { partnerName };
