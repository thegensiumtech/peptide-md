import type {
  ApiResponse,
  Availability,
  Booking,
  BookingFilters,
  DashboardSummary,
  DoctorProfile,
  Invoice,
  Partner,
  PartnerIntegration,
  PartnerStatus,
  PlatformSettings,
  VolumeBySource,
} from '@peptide/shared';
import { fail, ok } from '@peptide/shared';
import { apiFetch, query } from './server';

/**
 * Admin data, live from the API.
 *
 * Deliberately keeps the function names and the ApiResponse envelope the
 * screens were built against, so wiring them up was an import change rather
 * than a rewrite of every page.
 */

// The API returns lowercase enum strings already, matching the shared types.
type ApiBooking = Booking & {
  partnerName: string | null;
  /** A refund is a separate decision from the cancellation, see the API. */
  refundStatus: 'none' | 'pending' | 'approved' | 'declined' | 'failed';
  refundAmount: number | null;
  refundDeclineReason: string | null;
};

export async function getBookings(
  filters: BookingFilters = {}
): Promise<ApiResponse<ApiBooking[]>> {
  const result = await apiFetch<ApiBooking[]>(
    `/api/admin/bookings${query({
      channel: filters.channel,
      status: filters.status,
      partnerId: filters.partnerId,
      from: filters.from,
      to: filters.to,
      search: filters.search,
      page: filters.page,
      limit: filters.limit ?? 100,
    })}`
  );

  if (!result.success || !result.data) return fail(result.error ?? 'Bookings unavailable');
  return ok(result.data, result.meta);
}

export async function getBooking(id: string): Promise<ApiResponse<ApiBooking>> {
  const result = await apiFetch<ApiBooking>(`/api/admin/bookings/${id}`);
  if (!result.success || !result.data) return fail(result.error ?? 'Booking not found');
  return ok(result.data);
}

export async function getUpcomingBookings(
  options: { limit?: number } = {}
): Promise<ApiResponse<ApiBooking[]>> {
  const result = await apiFetch<ApiBooking[]>(
    `/api/admin/bookings${query({ status: 'confirmed', limit: options.limit ?? 10, upcoming: 'true' })}`
  );
  if (!result.success || !result.data) return fail(result.error ?? 'Bookings unavailable');

  const now = new Date().toISOString();
  const upcoming = result.data
    .filter((booking) => booking.startsAt >= now)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
    .slice(0, options.limit ?? 10);

  return ok(upcoming);
}

interface DashboardResponse {
  upcomingCount: number;
  monthVolume: VolumeBySource;
  billableThisMonth: number;
  directRevenueThisMonth: number;
  currency: string;
  volumeTrend?: VolumeBySource[];
}

export async function getDashboard(): Promise<ApiResponse<DashboardSummary>> {
  const result = await apiFetch<DashboardResponse>('/api/admin/dashboard');
  if (!result.success || !result.data) return fail(result.error ?? 'Dashboard unavailable');

  return ok({
    ...result.data,
    // The trend endpoint is part of the Milestone 2 reporting work; until then
    // the chart shows the current period only rather than inventing history.
    volumeTrend: result.data.volumeTrend ?? [result.data.monthVolume],
  });
}

interface DoctorResponse extends DoctorProfile {
  availability: Availability;
}

export async function getDoctorProfile(): Promise<ApiResponse<DoctorProfile>> {
  const result = await apiFetch<DoctorResponse>('/api/admin/doctor');
  if (!result.success || !result.data) return fail(result.error ?? 'Doctor profile unavailable');
  const { availability: _availability, ...profile } = result.data;
  return ok(profile);
}

export async function getAvailability(): Promise<ApiResponse<Availability>> {
  const result = await apiFetch<DoctorResponse>('/api/admin/doctor');
  if (!result.success || !result.data) return fail(result.error ?? 'Availability unavailable');
  return ok(result.data.availability);
}

export async function getDoctorWithAvailability(): Promise<ApiResponse<DoctorResponse>> {
  const result = await apiFetch<DoctorResponse>('/api/admin/doctor');
  if (!result.success || !result.data) return fail(result.error ?? 'Doctor unavailable');
  return ok(result.data);
}

export async function getSettings(): Promise<ApiResponse<PlatformSettings>> {
  const result = await apiFetch<PlatformSettings>('/api/admin/settings');
  if (!result.success || !result.data) return fail(result.error ?? 'Settings unavailable');
  return ok(result.data);
}

/* -------------------------------------------------------------------------
 * Partners and invoices
 *
 * These screens read fixtures until now. The function names match what
 * @/lib/data/client exported so the pages change an import rather than their
 * shape, which is the same approach the booking screens took.
 * ---------------------------------------------------------------------- */

/** Volume is returned alongside each partner, so the list is one request. */
export interface AdminPartner extends Partner {
  volume?: { appointmentCount: number; runningTotal: number };
  credentialList: Array<{
    id: string;
    clientId: string;
    secretLastFour: string;
    isSandbox: boolean;
    createdAt: string;
    lastUsedAt: string | null;
    expiresAt: string | null;
    revokedAt: string | null;
  }>;
}

interface PartnerRecord {
  id: string;
  name: string;
  slug: string;
  status: PartnerStatus;
  integration: PartnerIntegration;
  ratePerAppointment: number;
  currency: string;
  contactName: string;
  contactEmail: string;
  billingEmail: string;
  branding: Partner['branding'];
  rateLimitPerMinute: number;
  createdAt: string;
  credentials: AdminPartner['credentialList'];
  volume?: { appointmentCount: number; runningTotal: number };
}

/**
 * The API returns every credential; the shared Partner type carries one.
 *
 * The newest live credential is the one a screen means when it says "the
 * client id", so that is what fills the singular field, with the full list
 * kept alongside for the screens that manage rotation.
 */
function toPartner(record: PartnerRecord): AdminPartner {
  const live = record.credentials.find((c) => !c.isSandbox && !c.revokedAt) ?? record.credentials[0];
  return {
    id: record.id,
    name: record.name,
    slug: record.slug,
    status: record.status,
    integration: record.integration,
    ratePerAppointment: record.ratePerAppointment,
    currency: record.currency,
    contactName: record.contactName,
    contactEmail: record.contactEmail,
    billingEmail: record.billingEmail,
    branding: record.branding,
    rateLimitPerMinute: record.rateLimitPerMinute,
    createdAt: record.createdAt,
    credentials: {
      clientId: live?.clientId ?? '',
      secretLastFour: live?.secretLastFour ?? '',
      createdAt: live?.createdAt ?? record.createdAt,
      lastRotatedAt: live?.expiresAt ?? null,
      lastUsedAt: live?.lastUsedAt ?? null,
    },
    volume: record.volume,
    credentialList: record.credentials,
  };
}

export async function getPartners(): Promise<ApiResponse<AdminPartner[]>> {
  const result = await apiFetch<{ period: string; partners: PartnerRecord[] }>(
    '/api/admin/partners'
  );
  if (!result.success || !result.data) return fail(result.error ?? 'Partners unavailable');
  return ok(result.data.partners.map(toPartner));
}

export async function getPartner(id: string): Promise<ApiResponse<AdminPartner>> {
  const result = await apiFetch<{ period: string; partner: PartnerRecord }>(
    `/api/admin/partners/${encodeURIComponent(id)}`
  );
  if (!result.success || !result.data) return fail(result.error ?? 'Partner unavailable');
  return ok(toPartner(result.data.partner));
}

export interface AdminInvoice extends Invoice {
  sentAt: string | null;
}

export async function getInvoices(filters: {
  partnerId?: string;
  status?: string;
} = {}): Promise<ApiResponse<{ invoices: AdminInvoice[]; outstanding: number }>> {
  const result = await apiFetch<{ outstanding: number; invoices: AdminInvoice[] }>(
    `/api/admin/invoices${query({ partnerId: filters.partnerId, status: filters.status })}`
  );
  if (!result.success || !result.data) return fail(result.error ?? 'Invoices unavailable');
  return ok({ invoices: result.data.invoices, outstanding: result.data.outstanding });
}

export interface InvoiceAppointment {
  id: string;
  reference: string;
  startsAt: string;
  status: string;
  patientName: string;
  amount: number;
}

export async function getInvoice(id: string): Promise<
  ApiResponse<{ invoice: AdminInvoice; appointments: InvoiceAppointment[]; billingEmail: string }>
> {
  const result = await apiFetch<{
    invoice: AdminInvoice;
    appointments: InvoiceAppointment[];
    billingEmail: string;
  }>(`/api/admin/invoices/${encodeURIComponent(id)}`);
  if (!result.success || !result.data) return fail(result.error ?? 'Invoice unavailable');
  return ok(result.data);
}
