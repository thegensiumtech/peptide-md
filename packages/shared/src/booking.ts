/**
 * Booking domain.
 *
 * Every booking, taken on peptidemd.com or inside a partner's website, is
 * mirrored here and carries the channel it arrived through. That tag is what
 * the whole commercial model rests on: it is how the platform knows, at month
 * end, that New You sent sixty appointments and Five Peptides sent forty five.
 */

export const BOOKING_CHANNELS = ['direct', 'partner'] as const;
export type BookingChannel = (typeof BOOKING_CHANNELS)[number];

export const BOOKING_STATUSES = [
  'pending_payment',
  'confirmed',
  'cancelled',
  'completed',
  'no_show',
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const PAYMENT_STATUSES = ['unpaid', 'paid', 'refunded', 'failed'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

/** One answer to one intake question, as the doctor reads it before a consult. */
export interface IntakeAnswer {
  question: string;
  answer: string;
}

export interface Booking {
  id: string;
  /** Human-quotable reference shown to patients and partners, e.g. PMD-4821. */
  reference: string;
  /** The booking id held by the scheduling core (Cal.com). */
  externalBookingId: string;
  channel: BookingChannel;
  /** Null for direct bookings; the originating partner for partner bookings. */
  partnerId: string | null;
  status: BookingStatus;
  paymentStatus: PaymentStatus;
  /** ISO 8601, always UTC. Render in the viewer's timezone, never store local. */
  startsAt: string;
  endsAt: string;
  /** IANA zone the patient booked in, e.g. 'Australia/Sydney'. */
  patientTimezone: string;
  patientName: string;
  patientEmail: string;
  patientPhone: string;
  intake: IntakeAnswer[];
  /** Minor units (pence). Null on partner bookings, the partner takes payment. */
  amountPaid: number | null;
  currency: string;
  createdAt: string;
  cancelledAt: string | null;
  cancellationReason: string | null;
}

export interface BookingFilters {
  channel?: BookingChannel | 'all';
  status?: BookingStatus | 'all';
  partnerId?: string;
  /** Inclusive ISO date bounds, e.g. '2026-08-01'. */
  from?: string;
  to?: string;
  search?: string;
  page?: number;
  limit?: number;
}

/**
 * A partner booking is billable to that partner unless it was cancelled.
 * Direct bookings are never partner-billable, the patient already paid.
 */
export function isBillableToPartner(
  booking: Pick<Booking, 'channel' | 'status' | 'partnerId'>
): boolean {
  return booking.channel === 'partner' && booking.partnerId !== null && booking.status !== 'cancelled';
}

/** An available slot offered to a patient, in UTC. */
export interface Slot {
  startsAt: string;
  endsAt: string;
  available: boolean;
}

export interface DaySlots {
  /** Local calendar date in the patient's timezone, 'YYYY-MM-DD'. */
  date: string;
  slots: Slot[];
}
