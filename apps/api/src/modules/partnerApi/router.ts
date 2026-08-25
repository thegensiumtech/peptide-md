/**
 * The partner booking API, v1.
 *
 * This is the product other companies build against, which makes it different
 * from every other router here in three ways.
 *
 * **It is versioned and its shape is a promise.** Once New You have shipped
 * against `/api/v1`, changing a field name breaks their site, not ours. Adding
 * is safe, removing and renaming are not. A v2 gets a new mount point.
 *
 * **The tenant comes from the credential, never from the request.** There is
 * no `partnerId` parameter anywhere below, and there must never be one. A
 * partner cannot express a question about another partner's data because the
 * vocabulary does not exist.
 *
 * **There is no payment step.** The scope is explicit that the partner takes
 * the money on their own side, so a partner booking is created with
 * `amountPaid: null` and never touches Stripe. The pay-before-calendar rule is
 * a direct-channel rule and deliberately does not apply here. What does still
 * apply is the slot hold: a partner competes for a time on exactly the same
 * unique index as our own website, which is what stops a double booking.
 */
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '@peptide/database';
import { badRequest, conflict, handle, notFound, ok } from '../../http/errors';
import { partnerRateLimit } from '../../http/middleware/partnerRateLimit';
import { requirePartnerCredential, partnerContextOf } from '../../http/middleware/partnerAuth';
import { schedulingProvider } from '../../scheduling';
import { getSettings, nextReference, confirmBooking, cancelBooking, rescheduleBooking } from '../bookings/service';
import { logger } from '../../logger';

export const partnerApiRouter = Router();

// Counting comes before verifying, deliberately. See partnerRateLimit.
partnerApiRouter.use(partnerRateLimit, requirePartnerCredential);

/**
 * Which diary this credential books into.
 *
 * The whole of sandbox isolation is this function. A sandbox credential
 * resolves to a separate, inactive doctor, so a test booking cannot occupy a
 * real appointment even if every downstream filter were removed.
 */
async function diaryFor(isSandbox: boolean): Promise<{ id: string; timezone: string }> {
  const doctor = isSandbox
    ? await prisma.doctor.findFirst({ where: { gmcNumber: 'SANDBOX' } })
    : await prisma.doctor.findFirst({ where: { isActive: true } });

  if (!doctor) {
    throw notFound(
      isSandbox
        ? 'The sandbox diary is not configured. Contact Peptide MD.'
        : 'No doctor is currently taking bookings.'
    );
  }
  return { id: doctor.id, timezone: doctor.timezone };
}

const availabilityQuery = z.object({
  from: z.string().datetime().optional(),
  days: z.coerce.number().min(1).max(60).default(21),
});

/**
 * GET /api/v1/availability
 *
 * Times the partner may offer. Already excludes confirmed appointments and
 * live holds from every channel, so a slot returned here was genuinely free at
 * the moment of asking. It can still be taken a second later, which is what
 * POST /holds is for.
 */
partnerApiRouter.get(
  '/availability',
  handle(async (req, res) => {
    const { from, days } = availabilityQuery.parse(req.query);
    const { isSandbox } = partnerContextOf(req);
    const doctor = await diaryFor(isSandbox);
    const settings = await getSettings();

    const start = from ? new Date(from) : new Date();
    const end = new Date(start.getTime() + days * 24 * 60 * 60 * 1000);

    const slots = await schedulingProvider().getAvailability({
      doctorId: doctor.id,
      from: start,
      to: end,
      durationMinutes: settings.consultationDuration,
    });

    // Grouped by calendar date in the doctor's zone. A partner rendering their
    // own picker wants days, not a flat list of two hundred instants.
    const byDate = new Map<string, Array<{ startsAt: string; endsAt: string }>>();
    for (const slot of slots) {
      const key = new Intl.DateTimeFormat('en-CA', {
        timeZone: doctor.timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(slot.startsAt);

      const list = byDate.get(key) ?? [];
      list.push({ startsAt: slot.startsAt.toISOString(), endsAt: slot.endsAt.toISOString() });
      byDate.set(key, list);
    }

    return ok(res, {
      timezone: doctor.timezone,
      durationMinutes: settings.consultationDuration,
      sandbox: isSandbox,
      days: [...byDate.entries()].map(([date, daySlots]) => ({ date, slots: daySlots })),
    });
  })
);

const holdRequest = z.object({
  startsAt: z.string().datetime(),
});

/**
 * POST /api/v1/holds
 *
 * Locks a time to this partner for a few minutes so their patient can finish.
 * Returns 409 SLOT_TAKEN when another channel got there first, which is a
 * normal outcome and not an error the partner needs to escalate.
 */
partnerApiRouter.post(
  '/holds',
  handle(async (req, res) => {
    const { startsAt } = holdRequest.parse(req.body);
    const { partner, isSandbox } = partnerContextOf(req);
    const doctor = await diaryFor(isSandbox);
    const settings = await getSettings();

    const start = new Date(startsAt);
    if (start.getTime() <= Date.now()) {
      throw badRequest('That time is in the past.', 'SLOT_IN_PAST');
    }

    const end = new Date(start.getTime() + settings.consultationDuration * 60_000);

    const held = await schedulingProvider().hold({
      doctorId: doctor.id,
      startsAt: start,
      endsAt: end,
      channel: 'PARTNER',
      partnerId: partner.id,
      holdMinutes: settings.slotHoldMinutes,
    });

    if (!held) throw conflict('That time has just been taken.', 'SLOT_TAKEN');

    return ok(res, {
      holdToken: held.holdToken,
      expiresAt: held.expiresAt.toISOString(),
      startsAt: held.startsAt.toISOString(),
      endsAt: held.endsAt.toISOString(),
    });
  })
);

const createBooking = z.object({
  holdToken: z.string().min(1),
  patient: z.object({
    name: z.string().min(1, 'A patient name is required.'),
    email: z.string().email('A valid patient email is required.'),
    phone: z.string().min(1, 'A patient phone number is required.'),
    timezone: z.string().min(1, 'Send the patient timezone as an IANA name, e.g. Australia/Sydney.'),
  }),
  /** Optional. What the doctor sees before the consultation. */
  intake: z
    .array(z.object({ question: z.string().min(1), answer: z.string().min(1) }))
    .max(20)
    .optional(),
  /** The partner's own identifier, echoed back so they can reconcile. */
  reference: z.string().max(120).optional(),
});

/**
 * POST /api/v1/bookings
 *
 * Turns a hold into an appointment. The patient and the doctor are emailed
 * exactly as they would be for a direct booking, because from the doctor's
 * point of view it is the same appointment.
 */
partnerApiRouter.post(
  '/bookings',
  handle(async (req, res) => {
    const input = createBooking.parse(req.body);
    const { partner, isSandbox } = partnerContextOf(req);
    const doctor = await diaryFor(isSandbox);

    const hold = await prisma.slotHold.findUnique({ where: { holdToken: input.holdToken } });

    // Checked against this partner, not just existence. Otherwise a partner
    // who learned another's hold token could book on top of it.
    if (!hold || hold.partnerId !== partner.id || hold.doctorId !== doctor.id) {
      throw notFound('That hold could not be found.');
    }
    if (hold.bookingId) {
      throw conflict('That hold has already been used.', 'HOLD_ALREADY_USED');
    }
    if (hold.expiresAt <= new Date()) {
      throw conflict('That hold has expired. Take the time again.', 'HOLD_EXPIRED');
    }

    const email = input.patient.email.toLowerCase().trim();
    const patient = await prisma.patient.upsert({
      where: { email },
      update: { name: input.patient.name, phone: input.patient.phone, timezone: input.patient.timezone },
      create: {
        email,
        name: input.patient.name,
        phone: input.patient.phone,
        timezone: input.patient.timezone,
      },
    });

    const booking = await prisma.booking.create({
      data: {
        reference: await nextReference(),
        doctorId: doctor.id,
        patientId: patient.id,
        channel: 'PARTNER',
        partnerId: partner.id,
        isSandbox,
        status: 'PENDING_PAYMENT',
        // The partner took the money on their side, so there is nothing for us
        // to collect and nothing to refund. Recorded as PAID because, as far
        // as this platform is concerned, the appointment is settled.
        paymentStatus: 'PAID',
        amountPaid: null,
        currency: partner.currency,
        startsAt: hold.startsAt,
        endsAt: hold.endsAt,
        patientTimezone: input.patient.timezone,
      },
    });

    if (input.intake?.length) {
      await prisma.intakeResponse.createMany({
        data: input.intake.map((answer, position) => ({
          bookingId: booking.id,
          question: answer.question,
          answer: answer.answer,
          position,
        })),
      });
    }

    await prisma.slotHold.update({
      where: { holdToken: hold.holdToken },
      data: { bookingId: booking.id },
    });

    await confirmBooking(booking.id, hold.holdToken);

    const confirmed = await prisma.booking.findUnique({ where: { id: booking.id } });

    return ok(
      res,
      {
        id: booking.id,
        reference: confirmed?.reference ?? booking.reference,
        partnerReference: input.reference ?? null,
        status: (confirmed?.status ?? 'CONFIRMED').toLowerCase(),
        startsAt: booking.startsAt.toISOString(),
        endsAt: booking.endsAt.toISOString(),
        patientTimezone: booking.patientTimezone,
        joiningUrl: confirmed?.joiningUrl ?? null,
        sandbox: isSandbox,
      },
      undefined,
      201
    );
  })
);

/** Loads a booking and proves it belongs to the calling partner. */
async function ownedBooking(req: Parameters<typeof partnerContextOf>[0], id: string) {
  const { partner } = partnerContextOf(req);
  const booking = await prisma.booking.findUnique({ where: { id } });

  // Same answer for "does not exist" and "belongs to someone else". A partner
  // must not be able to probe our booking ids to learn who else we work with.
  if (!booking || booking.partnerId !== partner.id) {
    throw notFound('That booking could not be found.');
  }
  return booking;
}

const rescheduleRequest = z.object({ startsAt: z.string().datetime() });

/**
 * PATCH /api/v1/bookings/:id
 *
 * Moves an appointment. The new time is held first, so a reschedule that loses
 * a race fails without having given up the original time.
 */
partnerApiRouter.patch(
  '/bookings/:id',
  handle(async (req, res) => {
    const { startsAt } = rescheduleRequest.parse(req.body);
    const { partner, isSandbox } = partnerContextOf(req);
    const booking = await ownedBooking(req, String(req.params.id));

    if (booking.status !== 'CONFIRMED') {
      throw badRequest('Only a confirmed appointment can be moved.', 'NOT_RESCHEDULABLE');
    }

    const settings = await getSettings();
    const start = new Date(startsAt);
    if (start.getTime() <= Date.now()) {
      throw badRequest('That time is in the past.', 'SLOT_IN_PAST');
    }
    if (start.getTime() === booking.startsAt.getTime()) {
      throw badRequest('That is the time it is already booked for.', 'SAME_SLOT');
    }

    const end = new Date(start.getTime() + settings.consultationDuration * 60_000);

    const held = await schedulingProvider().hold({
      doctorId: booking.doctorId,
      startsAt: start,
      endsAt: end,
      channel: 'PARTNER',
      partnerId: partner.id,
      holdMinutes: settings.slotHoldMinutes,
    });

    if (!held) throw conflict('That time has just been taken.', 'SLOT_TAKEN');

    await rescheduleBooking(booking.id, held.startsAt, held.endsAt);
    await prisma.slotHold.update({
      where: { holdToken: held.holdToken },
      data: { bookingId: booking.id },
    });

    logger.info({ bookingId: booking.id, partnerId: partner.id, isSandbox }, 'Partner rescheduled');

    return ok(res, {
      id: booking.id,
      reference: booking.reference,
      status: 'confirmed',
      startsAt: held.startsAt.toISOString(),
      endsAt: held.endsAt.toISOString(),
    });
  })
);

const cancelRequest = z.object({ reason: z.string().max(500).optional() });

/**
 * DELETE /api/v1/bookings/:id
 *
 * Cancels and returns the time to the calendar on every channel at once.
 * No refund is requested: we never took the money.
 */
partnerApiRouter.delete(
  '/bookings/:id',
  handle(async (req, res) => {
    const { reason } = cancelRequest.parse(req.body ?? {});
    const { partner } = partnerContextOf(req);
    const booking = await ownedBooking(req, String(req.params.id));

    if (booking.status === 'CANCELLED') {
      return ok(res, { id: booking.id, reference: booking.reference, status: 'cancelled' });
    }

    await cancelBooking({
      bookingId: booking.id,
      reason: reason ?? 'Cancelled by the partner.',
      cancelledBy: `partner:${partner.slug}`,
      refund: false,
    });

    return ok(res, { id: booking.id, reference: booking.reference, status: 'cancelled' });
  })
);

/**
 * GET /api/v1/bookings
 *
 * What this partner has sent us. Clinical answers are deliberately not
 * returned: a partner is a referrer, not a party to the consultation.
 */
const listQuery = z.object({
  limit: z.coerce.number().min(1).max(200).default(50),
  from: z.string().datetime().optional(),
});

partnerApiRouter.get(
  '/bookings',
  handle(async (req, res) => {
    const { limit, from } = listQuery.parse(req.query);
    const { partner, isSandbox } = partnerContextOf(req);

    const bookings = await prisma.booking.findMany({
      where: {
        partnerId: partner.id,
        isSandbox,
        ...(from ? { startsAt: { gte: new Date(from) } } : {}),
      },
      include: { patient: true },
      orderBy: { startsAt: 'desc' },
      take: limit,
    });

    return ok(res, {
      bookings: bookings.map((booking) => ({
        id: booking.id,
        reference: booking.reference,
        status: booking.status.toLowerCase(),
        startsAt: booking.startsAt.toISOString(),
        endsAt: booking.endsAt.toISOString(),
        patientName: booking.patient.name,
        patientTimezone: booking.patientTimezone,
        createdAt: booking.createdAt.toISOString(),
      })),
    });
  })
);
