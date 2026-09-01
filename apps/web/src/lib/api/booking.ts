/**
 * Booking API, called from the browser.
 *
 * The booking flow is interactive from the payment screen onwards, so these
 * run client-side. Everything returns the same result shape, failures included,
 * so a screen branches on one thing and never on a thrown error.
 */
import { failure, type ApiResult } from './client';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

interface Envelope<T> {
  success: boolean;
  data: T | null;
  error: string | null;
  code?: string;
}

async function request<T>(
  path: string,
  init: { method: 'GET' | 'POST'; body?: unknown }
): Promise<ApiResult<T>> {
  let response: Response;

  try {
    response = await fetch(`${API_BASE}${path}`, {
      method: init.method,
      headers: { 'Content-Type': 'application/json' },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      cache: 'no-store',
    });
  } catch {
    return failure(
      'We could not reach the booking service. Check your connection and try again.',
      'NETWORK'
    );
  }

  if (response.status === 429) {
    return failure('Too many attempts. Wait a moment and try again.', 'RATE_LIMITED');
  }

  const envelope = (await response.json().catch(() => null)) as Envelope<T> | null;

  if (!envelope) {
    return failure('The booking service returned something we could not read.', 'BAD_RESPONSE');
  }

  if (!response.ok || !envelope.success || envelope.data === null) {
    return failure(envelope.error ?? 'Something went wrong. Please try again.', envelope.code);
  }

  return { success: true, data: envelope.data };
}

export interface ConsultationInfo {
  priceAmount: number;
  currency: string;
  durationMinutes: number;
  summary: string;
  inclusions: string[];
  deliveryNote: string;
  doctor: {
    id: string;
    name: string;
    credentials: string;
    gmcNumber: string;
    headline: string;
    bio: string;
    specialisms: string[];
    languages: string[];
    photoUrl: string | null;
    timezone: string;
  };
}

export interface AvailabilityPayload {
  timezone: string;
  durationMinutes: number;
  days: Array<{ date: string; slots: Array<{ startsAt: string; endsAt: string }> }>;
}

export const getConsultation = () =>
  request<ConsultationInfo>('/api/booking/consultation', { method: 'GET' });

export const getAvailability = (days = 21) =>
  request<AvailabilityPayload>(`/api/booking/availability?days=${days}`, { method: 'GET' });

export const startCheckout = (patientEmail: string) =>
  request<{ bookingId: string; reference: string; checkoutUrl: string; sessionId: string }>(
    '/api/booking/checkout',
    { method: 'POST', body: { patientEmail } }
  );

export const verifyPayment = (bookingId: string, sessionId: string) =>
  request<{ paymentStatus: string; alreadyConfirmed: boolean; country: string | null }>('/api/booking/verify-payment', {
    method: 'POST',
    body: { bookingId, sessionId },
  });

export const getBookingStatus = (bookingId: string) =>
  request<{
    bookingId: string;
    reference: string;
    status: string;
    paymentStatus: string;
    startsAt: string;
    timezone: string;
    doctorName: string;
  }>(`/api/booking/status/${bookingId}`, { method: 'GET' });

export const holdSlot = (bookingId: string, startsAt: string, timezone: string) =>
  request<{ holdToken: string; expiresAt: string; startsAt: string; endsAt: string }>(
    '/api/booking/hold',
    { method: 'POST', body: { bookingId, startsAt, timezone } }
  );

export interface IntakeSubmission {
  bookingId: string;
  holdToken: string;
  name: string;
  email: string;
  phone: string;
  timezone: string;
  answers: Array<{ question: string; answer: string }>;
  consentClinical: true;
  consentTerms: true;
}

export const submitIntake = (submission: IntakeSubmission) =>
  request<{
    reference: string;
    startsAt: string;
    endsAt: string;
    timezone: string;
    doctorName: string;
    status: string;
  }>('/api/booking/intake', { method: 'POST', body: submission });
