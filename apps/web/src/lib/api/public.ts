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
