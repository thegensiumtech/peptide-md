/**
 * Self-service appointment management.
 *
 * Patients have no login, the scope excludes patient accounts, so a booking
 * is reached by the two things the patient already holds: the reference from
 * their confirmation email, and the email address they booked with. Listing
 * runs off the email alone; anything that changes the diary requires both.
 *
 * The API decides what a patient may do and says so in the payload, rather than
 * shipping the rules to the browser and hoping it agrees. Every screen renders
 * the flags below; it never recomputes them.
 */

import type { BookingStatus, IntakeAnswer, PaymentStatus } from './booking';

/** One free slot offered for a reschedule, in UTC. Only free times are sent. */
export interface ManageSlot {
  startsAt: string;
  endsAt: string;
}

export interface ManageDaySlots {
  /** Calendar date in the doctor's timezone, 'YYYY-MM-DD'. */
  date: string;
  slots: ManageSlot[];
}

export interface ManageAvailability {
  timezone: string;
  durationMinutes: number;
  days: ManageDaySlots[];
}

/** What the patient may do to this appointment, decided server-side. */
export interface BookingPermissions {
  canReschedule: boolean;
  canCancel: boolean;
  /** True when cancelling now returns the money automatically. */
  refundOnCancel: boolean;
  /** Set when the action is unavailable, ready to show, not a code. */
  rescheduleBlockedReason: string | null;
  cancelBlockedReason: string | null;
}

/** A row in the patient's list of appointments. */
export interface ManagedBookingSummary extends BookingPermissions {
  reference: string;
  status: BookingStatus;
  paymentStatus: PaymentStatus;
  startsAt: string;
  endsAt: string;
  /** The zone the patient booked in. Every time is rendered in it. */
  timezone: string;
  doctorName: string;
  isUpcoming: boolean;
}

export interface ManagedBooking extends ManagedBookingSummary {
  patientName: string;
  patientEmail: string;
  patientPhone: string;
  joiningUrl: string | null;
  /** Minor units. Null on partner bookings, the partner took the payment. */
  amountPaid: number | null;
  currency: string;
  durationMinutes: number;
  createdAt: string;
  cancelledAt: string | null;
  cancellationReason: string | null;
  intake: IntakeAnswer[];
  policy: BookingPolicyTerms;
}

/** The terms the flags above were decided against, so the UI can explain them. */
export interface BookingPolicyTerms {
  freeCancellationNoticeHours: number;
  rescheduleCutoffHours: number;
}

export interface ManageLookupResult {
  email: string;
  policy: BookingPolicyTerms;
  upcoming: ManagedBookingSummary[];
  past: ManagedBookingSummary[];
}
