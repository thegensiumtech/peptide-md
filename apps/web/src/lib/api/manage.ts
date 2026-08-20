import type {
  ManageAvailability,
  ManageLookupResult,
  ManagedBooking,
} from '@peptide/shared';
import { postJson, type ApiResult } from './client';

/**
 * Patient self-service calls.
 *
 * There is no patient account, so access is proved by control of the inbox the
 * booking was made from: request a code, verify it, then carry the token it
 * returns. Every call below the first two takes that token; none of them takes
 * an email address, because the server reads it from the token instead.
 */

export interface ManageSessionToken {
  token: string;
  email: string;
  expiresAt: string;
}

export interface CancelOutcome {
  booking: ManagedBooking;
  /** The refund actually went through. */
  refunded: boolean;
  /** A refund is owed under the terms, whether or not it has been processed. */
  refundDue: boolean;
}

// --- Getting in --------------------------------------------------------------

export interface CodeRequestResult {
  sent: true;
  /**
   * Present only where the API is not delivering email, a local development
   * environment on the console provider. Never sent by a production build, so
   * the UI that shows it is dead code in production by construction.
   */
  devCode?: string;
}

/**
 * Ask for a six-digit code.
 *
 * Succeeds whether or not the address has any appointments, that is the point.
 * A response that varied would leak exactly what the code exists to protect.
 */
export function requestAccessCode(email: string): Promise<ApiResult<CodeRequestResult>> {
  return postJson('/api/booking/manage/request-code', { email });
}

export function verifyAccessCode(
  email: string,
  code: string
): Promise<ApiResult<ManageSessionToken>> {
  return postJson('/api/booking/manage/verify-code', { email, code });
}

// --- Reading -----------------------------------------------------------------

/** Every appointment on the session's address. */
export function lookupBookings(token: string): Promise<ApiResult<ManageLookupResult>> {
  return postJson('/api/booking/manage/lookup', {}, token);
}

export function fetchBooking(
  token: string,
  reference: string
): Promise<ApiResult<ManagedBooking>> {
  return postJson('/api/booking/manage/booking', { reference }, token);
}

/** Free times from this booking's own doctor, read live rather than cached. */
export function fetchRescheduleSlots(
  token: string,
  reference: string,
  days = 21
): Promise<ApiResult<ManageAvailability>> {
  return postJson('/api/booking/manage/availability', { reference, days }, token);
}

// --- Writing -----------------------------------------------------------------

export function rescheduleBooking(
  token: string,
  input: { reference: string; startsAt: string; timezone: string }
): Promise<ApiResult<ManagedBooking>> {
  return postJson('/api/booking/manage/reschedule', input, token);
}

export function cancelBooking(
  token: string,
  input: { reference: string; reason?: string }
): Promise<ApiResult<CancelOutcome>> {
  return postJson('/api/booking/manage/cancel', input, token);
}
