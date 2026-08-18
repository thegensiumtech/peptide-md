import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { prisma, type Prisma } from '@peptide/database';
import type {
  ManageAvailability,
  ManageLookupResult,
  ManagedBooking,
  ManagedBookingSummary,
} from '@peptide/shared';
import { badRequest, conflict, handle, notFound, ok } from '../../http/errors';
import { logger } from '../../logger';
import { schedulingProvider } from '../../scheduling';
import { cancelBooking, getSettings, rescheduleBooking } from './service';
import { POLICY_TERMS, evaluatePolicy } from './policy';
import {
  CODES_ARE_EXPOSED,
  manageEmailOf,
  requestAccessCode,
  requireManageSession,
  verifyAccessCode,
} from './accessCodes';

/**
 * Patient self-service.
 *
 * Patients have no account, so access rests on proving control of the inbox the
 * booking was made from: a six-digit code is emailed, and accepting it opens a
 * short session. An email address on its own opens nothing — it is not a
 * secret, and appointment times are clinical information.
 *
 * Everything is POST, including the reads. An email address in a query string
 * ends up in access logs and referrer headers, and on a medical booking that is
 * not an acceptable place for it to sit.
 */
export const manageBookingRouter = Router();

const emailField = z
  .string()
  .email('Enter the email address you booked with.')
  .transform((value) => value.toLowerCase().trim());

// --- Getting in --------------------------------------------------------------

/**
 * Unauthenticated and it sends email, so it is the tightest limit on the
 * platform. Someone asking for their own code needs one or two; anything past
 * that is either a typo storm or an attempt to use us as a mail cannon.
 */
const requestCodeLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 6,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    data: null,
    error: 'Too many code requests. Wait fifteen minutes, or contact us and we will help.',
  },
});

/** Guessing is already capped per code; this caps it per address across codes. */
const verifyCodeLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 12,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    data: null,
    error: 'Too many attempts. Wait fifteen minutes, or contact us and we will help.',
  },
});

/**
 * Ask for a code.
 *
 * Always reports the same thing. Whether an address has appointments, has none,
 * or has never been seen is exactly what this step exists to protect, so the
 * response cannot depend on it.
 */
manageBookingRouter.post(
  '/request-code',
  requestCodeLimiter,
  handle(async (req, res) => {
    const { email } = z.object({ email: emailField }).parse(req.body);
    const code = await requestAccessCode(email, req.ip);

    // Development convenience: where email is not delivered, the code would
    // otherwise have to be read out of the server log. `sent` is unconditional
    // either way, so the shape of the response still says nothing about whether
    // the address has appointments.
    return ok(res, {
      sent: true,
      ...(CODES_ARE_EXPOSED && code ? { devCode: code } : {}),
    });
  })
);

const verifyInput = z.object({
  email: emailField,
  code: z
    .string()
    .trim()
    // People paste '123 456' straight out of the email, and some keyboards
    // insert a non-breaking space. Strip anything that is not a digit.
    .transform((value) => value.replace(/\D/g, ''))
    .pipe(z.string().length(6, 'The code is six digits.')),
});

manageBookingRouter.post(
  '/verify-code',
  verifyCodeLimiter,
  handle(async (req, res) => {
    const { email, code } = verifyInput.parse(req.body);
    return ok(res, await verifyAccessCode(email, code));
  })
);

// --- Everything below needs a verified session -------------------------------

/**
 * Ordinary use is a handful of calls: list, open one, read the diary, act. This
 * sits well above that and well below anything worth calling automation.
 */
const sessionLimiter = rateLimit({
  windowMs: 60_000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    data: null,
    error: 'Too many requests. Wait a minute and try again.',
  },
});

manageBookingRouter.use(sessionLimiter, requireManageSession);

type BookingWithRelations = Prisma.BookingGetPayload<{
  include: { doctor: true; patient: true; intakeResponses: true };
}>;

/** References are quoted from an email, so case and stray spaces are forgiven. */
const referenceInput = z.object({
  reference: z
    .string()
    .min(1, 'Enter your booking reference.')
    .transform((value) => value.toUpperCase().trim()),
});

/**
 * Find a booking belonging to the session's address.
 *
 * The address comes off the verified token, never off the request, so holding a
 * session for one inbox cannot reach another person's appointments by editing a
 * field. A reference that does not exist and one belonging to someone else fail
 * identically.
 */
async function requireOwnedBooking(
  reference: string,
  email: string
): Promise<BookingWithRelations> {
  const booking = await prisma.booking.findUnique({
    where: { reference },
    include: { doctor: true, patient: true, intakeResponses: true },
  });

  if (booking?.patient.email.toLowerCase() !== email) {
    logger.info({ reference }, 'Manage lookup did not match a booking on this session');
    throw notFound('We could not find that booking on this email address.');
  }

  return booking;
}

function summarise(booking: BookingWithRelations, now: Date): ManagedBookingSummary {
  const verdict = evaluatePolicy(booking, now);

  return {
    reference: booking.reference,
    // Prisma's enums are upper case and the shared contract's are lower — the
    // same mapping the admin API does, kept in the serialiser rather than the UI.
    status: booking.status.toLowerCase() as ManagedBookingSummary['status'],
    paymentStatus: booking.paymentStatus.toLowerCase() as ManagedBookingSummary['paymentStatus'],
    startsAt: booking.startsAt.toISOString(),
    endsAt: booking.endsAt.toISOString(),
    timezone: booking.patientTimezone,
    doctorName: booking.doctor.name,
    isUpcoming: verdict.isUpcoming,
    canReschedule: verdict.canReschedule,
    canCancel: verdict.canCancel,
    refundOnCancel: verdict.refundOnCancel,
    rescheduleBlockedReason: verdict.rescheduleBlockedReason,
    cancelBlockedReason: verdict.cancelBlockedReason,
  };
}

function detail(booking: BookingWithRelations, durationMinutes: number, now: Date): ManagedBooking {
  return {
    ...summarise(booking, now),
    patientName: booking.patient.name,
    patientEmail: booking.patient.email,
    patientPhone: booking.patient.phone,
    joiningUrl: booking.joiningUrl,
    amountPaid: booking.amountPaid,
    currency: booking.currency,
    durationMinutes,
    createdAt: booking.createdAt.toISOString(),
    cancelledAt: booking.cancelledAt?.toISOString() ?? null,
    cancellationReason: booking.cancellationReason,
    intake: booking.intakeResponses
      .sort((a, b) => a.position - b.position)
      .map((response) => ({ question: response.question, answer: response.answer })),
    policy: POLICY_TERMS,
  };
}

// --- Reading -----------------------------------------------------------------

/** Every appointment on the session's address. */
manageBookingRouter.post(
  '/lookup',
  handle(async (req, res) => {
    const email = manageEmailOf(req);
    const now = new Date();

    const bookings = await prisma.booking.findMany({
      where: {
        patient: { email },
        // A pending-payment booking holds no time and carries a placeholder
        // date, so listing it would show the patient an appointment that does
        // not exist. Those are swept by the abandoned-checkout job.
        status: { not: 'PENDING_PAYMENT' },
      },
      include: { doctor: true, patient: true, intakeResponses: true },
      orderBy: { startsAt: 'desc' },
      take: 100,
    });

    const rows = bookings.map((booking) => summarise(booking, now));

    const result: ManageLookupResult = {
      email,
      policy: POLICY_TERMS,
      // Soonest first while it still matters; most recent first once it does not.
      upcoming: rows.filter((row) => row.isUpcoming).reverse(),
      past: rows.filter((row) => !row.isUpcoming),
    };

    return ok(res, result);
  })
);

/** One appointment in full, including the intake answers the patient gave. */
manageBookingRouter.post(
  '/booking',
  handle(async (req, res) => {
    const { reference } = referenceInput.parse(req.body);
    const [booking, settings] = await Promise.all([
      requireOwnedBooking(reference, manageEmailOf(req)),
      getSettings(),
    ]);

    return ok(res, detail(booking, settings.consultationDuration, new Date()));
  })
);

const availabilityInput = referenceInput.extend({
  days: z.coerce.number().min(1).max(60).default(21),
});

/**
 * Free times for a reschedule, from this booking's own doctor rather than
 * whoever happens to be the active one — the patient must land back with the
 * doctor they were booked with.
 */
manageBookingRouter.post(
  '/availability',
  handle(async (req, res) => {
    const { reference, days } = availabilityInput.parse(req.body);
    const [booking, settings] = await Promise.all([
      requireOwnedBooking(reference, manageEmailOf(req)),
      getSettings(),
    ]);

    const from = new Date();
    const to = new Date(from.getTime() + days * 24 * 60 * 60 * 1000);

    const slots = await schedulingProvider().getAvailability({
      doctorId: booking.doctorId,
      from,
      to,
      durationMinutes: settings.consultationDuration,
    });

    // Grouped by the doctor's calendar day; the browser renders them in the
    // patient's own zone. Deliberately uncached — a patient choosing a
    // replacement time needs the diary as it is this second.
    const byDay = new Map<string, Array<{ startsAt: string; endsAt: string }>>();
    for (const slot of slots) {
      const key = slot.startsAt.toISOString().slice(0, 10);
      const list = byDay.get(key) ?? [];
      list.push({ startsAt: slot.startsAt.toISOString(), endsAt: slot.endsAt.toISOString() });
      byDay.set(key, list);
    }

    const payload: ManageAvailability = {
      timezone: booking.doctor.timezone,
      durationMinutes: settings.consultationDuration,
      days: [...byDay.entries()].map(([date, daySlots]) => ({ date, slots: daySlots })),
    };

    return ok(res, payload);
  })
);

// --- Writing -----------------------------------------------------------------

const rescheduleInput = referenceInput.extend({
  startsAt: z.string().datetime(),
  timezone: z.string().min(1).optional(),
});

/**
 * Move an appointment.
 *
 * The new time is taken through the same lock as a first booking: hold it,
 * move the booking, then release. Between the hold and the release the slot is
 * unavailable to every other channel, so two patients cannot land on the same
 * time from opposite sides of the platform.
 */
manageBookingRouter.post(
  '/reschedule',
  handle(async (req, res) => {
    const input = rescheduleInput.parse(req.body);
    const email = manageEmailOf(req);
    const [booking, settings] = await Promise.all([
      requireOwnedBooking(input.reference, email),
      getSettings(),
    ]);

    const verdict = evaluatePolicy(booking);
    if (!verdict.canReschedule) {
      throw badRequest(
        verdict.rescheduleBlockedReason ?? 'This appointment can no longer be moved.',
        'RESCHEDULE_NOT_ALLOWED'
      );
    }

    const startsAt = new Date(input.startsAt);
    const endsAt = new Date(startsAt.getTime() + settings.consultationDuration * 60_000);

    if (startsAt.getTime() === booking.startsAt.getTime()) {
      throw badRequest('That is the time you are already booked for.', 'SAME_SLOT');
    }

    const provider = schedulingProvider();

    // The slot must be one the doctor actually offers, not merely one nobody
    // has taken — otherwise a crafted request could book outside surgery hours.
    const offered = await provider.getAvailability({
      doctorId: booking.doctorId,
      from: new Date(startsAt.getTime() - 60_000),
      to: new Date(endsAt.getTime() + 60_000),
      durationMinutes: settings.consultationDuration,
    });

    if (!offered.some((slot) => slot.startsAt.getTime() === startsAt.getTime())) {
      throw conflict('That time is not available. Please choose another.', 'SLOT_UNAVAILABLE');
    }

    const held = await provider.hold({
      doctorId: booking.doctorId,
      startsAt,
      endsAt,
      channel: booking.channel,
      partnerId: booking.partnerId ?? undefined,
      holdMinutes: settings.slotHoldMinutes,
    });

    // Lost the race: someone reached that time a moment earlier.
    if (!held) throw conflict('That time has just been taken. Please choose another.', 'SLOT_TAKEN');

    try {
      await rescheduleBooking(booking.id, startsAt, endsAt);

      if (input.timezone && input.timezone !== booking.patientTimezone) {
        await prisma.booking.update({
          where: { id: booking.id },
          data: { patientTimezone: input.timezone },
        });
      }
    } finally {
      // The booking row now occupies the time, so the temporary lock has done
      // its job. Released in a finally so a failed move never strands a slot.
      await provider.release(held.holdToken).catch(() => undefined);
    }

    const moved = await requireOwnedBooking(input.reference, email);
    logger.info({ reference: booking.reference }, 'Patient rescheduled their appointment');

    return ok(res, detail(moved, settings.consultationDuration, new Date()));
  })
);

const cancelInput = referenceInput.extend({
  reason: z.string().max(500, 'Keep the reason under 500 characters.').optional(),
});

/**
 * Cancel an appointment.
 *
 * The slot returns to the diary as part of this — a cancelled booking no longer
 * counts as taken, and any hold against it is deleted — so the time is bookable
 * by the next patient immediately.
 */
manageBookingRouter.post(
  '/cancel',
  handle(async (req, res) => {
    const input = cancelInput.parse(req.body);
    const email = manageEmailOf(req);
    const [booking, settings] = await Promise.all([
      requireOwnedBooking(input.reference, email),
      getSettings(),
    ]);

    const verdict = evaluatePolicy(booking);
    if (!verdict.canCancel) {
      throw badRequest(
        verdict.cancelBlockedReason ?? 'This appointment can no longer be cancelled.',
        'CANCEL_NOT_ALLOWED'
      );
    }

    const { refundRequested } = await cancelBooking({
      bookingId: booking.id,
      reason: input.reason?.trim() || 'Cancelled by the patient.',
      cancelledBy: `patient:${booking.patient.email}`,
      refund: verdict.refundOnCancel,
    });

    const cancelled = await requireOwnedBooking(input.reference, email);
    logger.info({ reference: booking.reference, refundRequested }, 'Patient cancelled their appointment');

    return ok(res, {
      booking: detail(cancelled, settings.consultationDuration, new Date()),
      // What actually happened, and what was owed. They differ when a refund is
      // due but Stripe declined it — the patient is told a person will finish it
      // rather than being told their money is already on its way.
      // The money has not moved yet — an admin still has to approve it.
      refundRequested,
      refundDue: verdict.refundOnCancel,
    });
  })
);
