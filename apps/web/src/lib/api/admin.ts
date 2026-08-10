import type {
  ApiResponse,
  Availability,
  Booking,
  BookingFilters,
  DashboardSummary,
  DoctorProfile,
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
type ApiBooking = Booking & { partnerName: string | null };

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
