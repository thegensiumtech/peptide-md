import type { Booking } from '@peptide/database';
import type { BookingPermissions, BookingPolicyTerms } from '@peptide/shared';

/**
 * What a patient may do to their own appointment.
 *
 * The rules live here, in one place, because they are quoted in three: the
 * confirmation screen, the confirmation email, and the manage screens. Changing
 * a number here changes all of them.
 *
 * These are the terms the site already promises — free rescheduling, and a full
 * refund on a cancellation with a day's notice. They belong in platform
 * settings once the admin needs to edit them without a deploy.
 */
export const FREE_CANCELLATION_NOTICE_HOURS = 24;

/**
 * How close to the appointment self-service rescheduling stops. Inside this
 * window the doctor's day is already committed, so a move goes through a human
 * rather than silently rearranging the diary an hour beforehand.
 */
export const RESCHEDULE_CUTOFF_HOURS = 2;

export const POLICY_TERMS: BookingPolicyTerms = {
  freeCancellationNoticeHours: FREE_CANCELLATION_NOTICE_HOURS,
  rescheduleCutoffHours: RESCHEDULE_CUTOFF_HOURS,
};

const HOUR_MS = 60 * 60 * 1000;

export interface PolicyVerdict extends BookingPermissions {
  isUpcoming: boolean;
  hoursUntilStart: number;
}

type PolicyInput = Pick<Booking, 'status' | 'paymentStatus' | 'startsAt'>;

/**
 * Decided on the server and sent to the browser as flags. The screens render
 * the verdict; they never re-derive it, so a stale tab cannot offer an action
 * the API would refuse.
 */
export function evaluatePolicy(booking: PolicyInput, now: Date = new Date()): PolicyVerdict {
  const hoursUntilStart = (booking.startsAt.getTime() - now.getTime()) / HOUR_MS;
  const isUpcoming = booking.startsAt > now && booking.status === 'CONFIRMED';

  const blocked = terminalReason(booking, hoursUntilStart);
  if (blocked) {
    return {
      isUpcoming: false,
      hoursUntilStart,
      canReschedule: false,
      canCancel: false,
      refundOnCancel: false,
      rescheduleBlockedReason: blocked,
      cancelBlockedReason: blocked,
    };
  }

  // Cancelling stays open right up to the appointment — a patient who cannot
  // attend should always be able to say so, and the slot returns to the diary
  // either way. Only the refund depends on how much notice was given.
  const refundOnCancel =
    booking.paymentStatus === 'PAID' && hoursUntilStart >= FREE_CANCELLATION_NOTICE_HOURS;

  const tooLateToMove = hoursUntilStart < RESCHEDULE_CUTOFF_HOURS;

  return {
    isUpcoming,
    hoursUntilStart,
    canReschedule: !tooLateToMove,
    rescheduleBlockedReason: tooLateToMove
      ? `Appointments can only be moved more than ${RESCHEDULE_CUTOFF_HOURS} hours ahead. Contact us and we will move it for you.`
      : null,
    canCancel: true,
    cancelBlockedReason: null,
    refundOnCancel,
  };
}

/** The reasons nothing at all can be done, in the order worth reporting. */
function terminalReason(booking: PolicyInput, hoursUntilStart: number): string | null {
  if (booking.status === 'CANCELLED') return 'This appointment has already been cancelled.';
  if (booking.status === 'COMPLETED') return 'This consultation has already taken place.';
  if (booking.status === 'NO_SHOW') return 'This appointment has already passed.';
  if (booking.status === 'PENDING_PAYMENT') {
    return 'This booking was never paid for, so no time was reserved. Start a new booking to choose a time.';
  }
  if (hoursUntilStart <= 0) return 'This appointment has already passed.';
  return null;
}
