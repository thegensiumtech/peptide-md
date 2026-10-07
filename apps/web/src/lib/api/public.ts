import type { ApiResponse, ConsultationSettings, DoctorProfile } from '@peptide/shared';
import { fail, ok } from '@peptide/shared';
import { apiFetch } from './server';

/**
 * Public data, read on the server.
 *
 * The price and the doctor's profile are admin-editable, so the marketing and
 * booking screens read them live rather than from a build-time copy, a price
 * change in the admin panel has to be true on the site immediately.
 */
interface ConsultationResponse extends ConsultationSettings {
  doctor: DoctorProfile;
}

export async function getConsultation(): Promise<ApiResponse<ConsultationResponse>> {
  const result = await apiFetch<ConsultationResponse>('/api/booking/consultation', {
    authenticated: false,
    // Short cache: correct within a minute of an admin change, and it stops a
    // burst of traffic hitting the database for a value that rarely moves.
    revalidate: 60,
  });

  if (!result.success || !result.data) {
    return fail(result.error ?? 'Consultation details unavailable');
  }
  return ok(result.data);
}

interface AvailabilityResponse {
  days: Array<{ date: string; slots: Array<{ startsAt: string; endsAt: string }> }>;
}

/**
 * The earliest bookable time, read from the live diary.
 *
 * Returns null when nothing is free or the diary cannot be read, and the page
 * then shows nothing. A stale or invented date is worse than no date: it
 * promises a time the patient will not find on the calendar.
 */
export async function getNextAvailableSlot(): Promise<string | null> {
  const result = await apiFetch<AvailabilityResponse>('/api/booking/availability?days=21', {
    authenticated: false,
    // Sits on top of the API's own 60-second cache, so a time taken moments
    // ago can show here for up to about a minute and a half. The slot picker
    // reads the diary uncached, so nobody can book a time that has gone.
    revalidate: 30,
  });

  if (!result.success || !result.data) return null;
  return result.data.days[0]?.slots[0]?.startsAt ?? null;
}
