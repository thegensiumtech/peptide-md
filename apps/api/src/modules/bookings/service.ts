import { prisma, type Booking, type Doctor, type Patient } from '@peptide/database';
import { config } from '../../config';
import { logger } from '../../logger';
import { sendEmail, alreadySent } from '../../email';
import {
  appointmentReminder,
  cancellationNotice,
  doctorNotification,
  patientConfirmation,
  refundConfirmation,
  rescheduleNotice,
  type BookingEmailContext,
} from '../../email/templates';
import { schedulingProvider } from '../../scheduling';
import { refundPayment } from '../../payments/stripe';
import { cacheDelete } from '../../lib/redis';

/**
 * Availability is cached for a minute, so anything that frees or takes a time
 * has to invalidate it. Without this a cancelled slot keeps reading as busy for
 * up to sixty seconds — which is exactly the window a patient is looking at it.
 */
async function bustAvailability(doctorId: string): Promise<void> {
  await cacheDelete(`availability:${doctorId}:*`);
}

/**
 * Human-quotable reference. Sequential rather than random so it stays short
 * enough to read down a phone.
 *
 * Drawn from a Postgres sequence rather than from max(reference) + 1. Reading
 * the highest existing reference and incrementing it looks fine until two
 * patients start checkout in the same moment: both read the same value, both
 * build the same reference, and one of them hits the unique index and fails
 * mid-payment. A sequence hands every caller a distinct number no matter how
 * many are asking at once.
 */
export async function nextReference(): Promise<string> {
  const [row] = await prisma.$queryRaw<Array<{ value: bigint }>>`
    SELECT nextval('booking_reference_seq') AS value
  `;
  return `PMD-${row!.value.toString()}`;
}

export async function getSettings() {
  const settings = await prisma.platformSettings.findUnique({ where: { id: 'singleton' } });
  if (!settings) throw new Error('Platform settings row is missing — run the seed.');
  return settings;
}

function emailContext(
  booking: Booking & { patient: Patient; doctor: Doctor },
  fromName: string,
  fromEmail: string
): BookingEmailContext {
  return {
    reference: booking.reference,
    patientName: booking.patient.name,
    patientEmail: booking.patient.email,
    patientTimezone: booking.patientTimezone,
    doctorName: booking.doctor.name,
    startsAt: booking.startsAt,
    endsAt: booking.endsAt,
    joiningUrl: booking.joiningUrl,
    fromName,
    fromEmail,
    webUrl: config.WEB_URL,
  };
}

async function loadBooking(bookingId: string) {
  return prisma.booking.findUnique({
    where: { id: bookingId },
    include: { patient: true, doctor: true },
  });
}

/**
 * Confirm a paid booking.
 *
 * Called only from the Stripe webhook for direct bookings, and from the
 * partner API for partner bookings. The browser never reaches this — that is
 * what stops an unpaid booking existing in the diary.
 *
 * Idempotent: Stripe retries webhooks, so a second call on an already
 * confirmed booking does nothing rather than double-sending emails.
 */
export async function confirmBooking(bookingId: string, holdToken?: string): Promise<void> {
  const booking = await loadBooking(bookingId);
  if (!booking) {
    logger.error({ bookingId }, 'Confirm called for a booking that does not exist');
    return;
  }
  if (booking.status === 'CONFIRMED') return;

  const settings = await getSettings();
  const provider = schedulingProvider();

  let externalBookingId = booking.externalBookingId;
  let joiningUrl = booking.joiningUrl;

  if (holdToken) {
    try {
      const confirmed = await provider.confirm({
        holdToken,
        bookingId: booking.id,
        patientName: booking.patient.name,
        patientEmail: booking.patient.email,
        patientTimezone: booking.patientTimezone,
      });
      externalBookingId = confirmed.externalBookingId;
      joiningUrl = confirmed.joiningUrl ?? booking.joiningUrl;
    } catch (error) {
      // The money is taken and the slot is held. Failing here would lose the
      // booking, so it is recorded as recoverable and surfaced in the admin
      // panel rather than thrown away.
      logger.error({ err: error, bookingId }, 'Scheduling confirm failed after payment');
    }
  }

  const updated = await prisma.booking.update({
    where: { id: booking.id },
    data: {
      status: 'CONFIRMED',
      paymentStatus: 'PAID',
      externalBookingId,
      joiningUrl,
    },
    include: { patient: true, doctor: true },
  });

  const context = emailContext(updated, settings.emailFromName, settings.emailFromAddress);

  if (!(await alreadySent(booking.id, 'PATIENT_CONFIRMATION'))) {
    await sendEmail('PATIENT_CONFIRMATION', patientConfirmation(context), booking.id);
  }

  if (settings.notifyDoctorOnBooking) {
    const doctorUser = await prisma.user.findFirst({
      where: { doctorId: updated.doctorId, role: 'DOCTOR' },
      select: { email: true },
    });
    if (doctorUser && !(await alreadySent(booking.id, 'DOCTOR_NOTIFICATION'))) {
      await sendEmail('DOCTOR_NOTIFICATION', doctorNotification(context, doctorUser.email), booking.id);
    }
  }
}

/**
 * Record a successful payment, once.
 *
 * Two independent paths report the same fact: the Stripe webhook, and the
 * return-path verification when the patient beats the webhook back. Both are
 * correct and either may arrive first, so this is an upsert keyed on the
 * payment intent — the identifier Stripe guarantees is unique per payment.
 *
 * The session id deliberately stays on the CHECKOUT_CREATED row that already
 * holds it. Writing it again here collides with that row's unique index, which
 * is exactly the bug this replaces.
 */
export async function recordSuccessfulPayment(options: {
  bookingId: string;
  paymentIntentId: string | null;
  amount: number;
  currency: string;
}): Promise<void> {
  const { bookingId, paymentIntentId, amount, currency } = options;

  if (!paymentIntentId) {
    const existing = await prisma.payment.findFirst({ where: { bookingId, type: 'SUCCEEDED' } });
    if (!existing) {
      await prisma.payment.create({ data: { bookingId, amount, currency, type: 'SUCCEEDED' } });
    }
    return;
  }

  await prisma.payment.upsert({
    where: { stripePaymentIntentId: paymentIntentId },
    update: { type: 'SUCCEEDED', amount, currency },
    create: { bookingId, stripePaymentIntentId: paymentIntentId, amount, currency, type: 'SUCCEEDED' },
  });
}

/** Payment failed or the session expired. No slot was consumed — release the hold. */
export async function failBooking(
  bookingId: string,
  reason: string,
  holdToken?: string
): Promise<void> {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking || booking.status === 'CONFIRMED') return;

  if (holdToken) await schedulingProvider().release(holdToken).catch(() => undefined);
  await prisma.slotHold.deleteMany({ where: { bookingId } });

  await prisma.booking.update({
    where: { id: bookingId },
    data: { paymentStatus: 'FAILED' },
  });

  logger.info({ bookingId, reason }, 'Payment failed — slot released');
}

/**
 * Cancel and, where the terms allow it, refund.
 *
 * Returns whether the money actually moved rather than whether it was owed —
 * a refund can be due and still fail at Stripe, and the patient must not be
 * told they have been refunded when they have not.
 */
export async function cancelBooking(options: {
  bookingId: string;
  reason: string;
  cancelledBy: string;
  refund: boolean;
}): Promise<{ refundRequested: boolean }> {
  const booking = await loadBooking(options.bookingId);
  if (!booking) throw new Error('Booking not found');
  if (booking.status === 'CANCELLED') return { refundRequested: false };

  const settings = await getSettings();

  // A refund is requested here, never processed. The appointment is released
  // immediately because the patient should not wait on an approval for that,
  // but the money is a separate decision an admin makes afterwards.
  const refundRequested = options.refund && booking.paymentStatus === 'PAID';

  // Release the slot first — a cancellation must return the time to the
  // calendar even if the notification emails fail afterwards.
  if (booking.externalBookingId) {
    await schedulingProvider().cancel(booking.externalBookingId).catch(() => undefined);
  }
  await prisma.slotHold.deleteMany({ where: { bookingId: booking.id } });

  const updated = await prisma.booking.update({
    where: { id: booking.id },
    data: {
      status: 'CANCELLED',
      refundStatus: refundRequested ? 'PENDING' : booking.refundStatus,
      refundAmount: refundRequested ? booking.amountPaid : null,
      refundRequestedAt: refundRequested ? new Date() : null,
      refundRequestedBy: refundRequested ? options.cancelledBy : null,
      cancelledAt: new Date(),
      cancellationReason: options.reason,
      cancelledBy: options.cancelledBy,
    },
    include: { patient: true, doctor: true },
  });

  // A cancelled booking no longer counts as taken, so the time is free from
  // this moment. The cache is the only thing that could still say otherwise.
  await bustAvailability(updated.doctorId);

  const context = emailContext(updated, settings.emailFromName, settings.emailFromAddress);
  await sendEmail('CANCELLATION', cancellationNotice(context, options.reason, false, refundRequested), booking.id);

  if (settings.notifyDoctorOnCancellation) {
    const doctorUser = await prisma.user.findFirst({
      where: { doctorId: updated.doctorId, role: 'DOCTOR' },
      select: { email: true },
    });
    if (doctorUser) {
      await sendEmail(
        'CANCELLATION',
        { ...cancellationNotice(context, options.reason, false, refundRequested), to: doctorUser.email },
        booking.id
      );
    }
  }

  return { refundRequested };
}

export async function rescheduleBooking(
  bookingId: string,
  startsAt: Date,
  endsAt: Date
): Promise<void> {
  const booking = await loadBooking(bookingId);
  if (!booking) throw new Error('Booking not found');

  const settings = await getSettings();
  const previous = booking.startsAt;

  if (booking.externalBookingId) {
    await schedulingProvider()
      .reschedule(booking.externalBookingId, { startsAt, endsAt })
      .catch(() => undefined);
  }

  const updated = await prisma.booking.update({
    where: { id: bookingId },
    data: { startsAt, endsAt },
    include: { patient: true, doctor: true },
  });

  // Two times changed hands: the one given up and the one taken.
  await bustAvailability(updated.doctorId);

  const context = emailContext(updated, settings.emailFromName, settings.emailFromAddress);
  await sendEmail('RESCHEDULE', rescheduleNotice(context, previous), bookingId);
}

/**
 * Reminder sweep. Sends to confirmed appointments inside the lead window that
 * have not already been reminded. Driven by a scheduled job in production.
 */
export async function sendDueReminders(): Promise<number> {
  const settings = await getSettings();
  const now = new Date();
  const horizon = new Date(now.getTime() + settings.reminderLeadHours * 60 * 60 * 1000);

  const due = await prisma.booking.findMany({
    where: {
      status: 'CONFIRMED',
      remindedAt: null,
      startsAt: { gt: now, lte: horizon },
    },
    include: { patient: true, doctor: true },
  });

  for (const booking of due) {
    const context = emailContext(booking, settings.emailFromName, settings.emailFromAddress);
    await sendEmail('APPOINTMENT_REMINDER', appointmentReminder(context), booking.id);
    await prisma.booking.update({
      where: { id: booking.id },
      data: { remindedAt: new Date() },
    });
  }

  return due.length;
}

/**
 * Sweep abandoned checkouts.
 *
 * A patient who closes the browser mid-payment leaves a pending booking and,
 * if they had reached the slot screen, a hold. Both expire; this clears them
 * so the time is genuinely free again.
 */
export async function releaseExpiredHolds(): Promise<number> {
  // Every hold is linked to its booking the moment it is taken, so filtering
  // on a null bookingId would sweep nothing at all — and a patient who paid,
  // chose a time, then closed the browser at the intake step would block that
  // slot forever. What actually matters is whether the booking ever reached
  // CONFIRMED; if it did, the booking itself keeps the time occupied and the
  // hold is redundant.
  const expired = await prisma.slotHold.findMany({
    where: {
      expiresAt: { lte: new Date() },
      OR: [{ bookingId: null }, { booking: { status: { not: 'CONFIRMED' } } }],
    },
    select: { id: true, doctorId: true },
  });

  if (expired.length === 0) return 0;

  await prisma.slotHold.deleteMany({ where: { id: { in: expired.map((h) => h.id) } } });

  // Availability is cached for a minute. Without this the freed time keeps
  // reading as busy for up to sixty seconds — exactly while someone is looking
  // at the calendar wondering why it is not there.
  await Promise.all([...new Set(expired.map((h) => h.doctorId))].map(bustAvailability));

  logger.info({ count: expired.length }, 'Expired slot holds released');
  return expired.length;
}

/**
 * Approve a pending refund and send the money back.
 *
 * The only place in the platform that moves money out. It refuses anything not
 * actually pending, so a double-click or a replayed request cannot refund
 * twice.
 */
export async function approveRefund(bookingId: string, decidedBy: string): Promise<void> {
  const booking = await loadBooking(bookingId);
  if (!booking) throw new Error('Booking not found');
  if (booking.refundStatus !== 'PENDING') {
    throw new Error('That refund is not awaiting approval.');
  }

  const payment = await prisma.payment.findFirst({
    where: { bookingId, type: 'SUCCEEDED' },
    orderBy: { createdAt: 'desc' },
  });

  if (!payment?.stripePaymentIntentId) {
    await prisma.booking.update({
      where: { id: bookingId },
      data: { refundStatus: 'FAILED', refundDecidedAt: new Date(), refundDecidedBy: decidedBy },
    });
    throw new Error('No Stripe payment is recorded against this booking.');
  }

  try {
    const refund = await refundPayment(payment.stripePaymentIntentId);
    await prisma.payment.create({
      data: {
        bookingId,
        stripeRefundId: refund.id,
        amount: booking.refundAmount ?? payment.amount,
        currency: payment.currency,
        type: 'REFUNDED',
      },
    });
    await prisma.booking.update({
      where: { id: bookingId },
      data: {
        refundStatus: 'APPROVED',
        paymentStatus: 'REFUNDED',
        refundDecidedAt: new Date(),
        refundDecidedBy: decidedBy,
      },
    });

    const settings = await getSettings();
    const context = emailContext(booking, settings.emailFromName, settings.emailFromAddress);
    await sendEmail('REFUND_CONFIRMATION', refundConfirmation(context, booking.refundAmount ?? payment.amount), bookingId);
    logger.info({ bookingId }, 'Refund approved and sent');
  } catch (error) {
    // Left FAILED rather than PENDING, so it shows as needing attention
    // instead of quietly sitting in the queue as though untouched.
    await prisma.booking.update({
      where: { id: bookingId },
      data: { refundStatus: 'FAILED', refundDecidedAt: new Date(), refundDecidedBy: decidedBy },
    });
    logger.error({ err: error, bookingId }, 'Refund failed at Stripe');
    throw error;
  }
}

/** Refuse a refund, with a reason kept on the record. */
export async function declineRefund(
  bookingId: string,
  decidedBy: string,
  reason: string
): Promise<void> {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) throw new Error('Booking not found');
  if (booking.refundStatus !== 'PENDING' && booking.refundStatus !== 'FAILED') {
    throw new Error('That refund is not awaiting a decision.');
  }

  await prisma.booking.update({
    where: { id: bookingId },
    data: {
      refundStatus: 'DECLINED',
      refundDecidedAt: new Date(),
      refundDecidedBy: decidedBy,
      refundDeclineReason: reason,
    },
  });
  logger.info({ bookingId, reason }, 'Refund declined');
}
