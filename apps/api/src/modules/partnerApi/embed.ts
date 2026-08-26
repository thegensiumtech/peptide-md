/**
 * The embedded widget's own API.
 *
 * Separate from /api/v1 because the trust model is completely different, and
 * conflating them would be the mistake that leaks a partner's secret.
 *
 * /api/v1 is server-to-server: the caller holds a secret and is trusted to act
 * for the partner. This runs **in a patient's browser**, inside an iframe on
 * the partner's website. Anything it needs to authenticate with is visible to
 * anyone who opens developer tools, so it cannot hold a secret at all.
 *
 * So it authenticates with the client id alone, which is public by design. The
 * question it answers is "which partner is this booking for", not "is this
 * caller allowed to act". That is the right question, because a booking widget
 * is a public form: any visitor to the partner's site is meant to be able to
 * use it.
 *
 * What stops abuse instead:
 *  - Rate limiting per client id and per address, so a script cannot flood the
 *    diary.
 *  - Holds expire on their own, so a burst of holds frees itself.
 *  - Nothing here reads. There is no endpoint that returns a booking, a
 *    patient or another partner's data, so there is nothing to harvest.
 */
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '@peptide/database';
import { badRequest, conflict, handle, notFound, ok } from '../../http/errors';
import { consume } from '../../lib/rateLimiter';
import { schedulingProvider } from '../../scheduling';
import { getSettings, nextReference, confirmBooking } from '../bookings/service';
import { logger } from '../../logger';

export const embedRouter = Router();

/** Stored verbatim on every embed booking. See the consent record below. */
export const CONSENT_WORDING =
  'I consent to a private medical consultation and to my answers being held as part of my clinical record. I understand this is general medical advice and that no compound is supplied, prescribed or dispensed.';

/** Deliberately tighter than the partner API: this is an unauthenticated form. */
const WINDOW_SECONDS = 60;
const PER_CLIENT_LIMIT = 120;
const PER_ADDRESS_LIMIT = 20;

embedRouter.use(
  '/:clientId',
  handle(async (req, res, next) => {
    const clientId = String(req.params.clientId);
    const address = req.ip ?? 'unknown';

    const byAddress = await consume(`embed:addr:${address}`, PER_ADDRESS_LIMIT, WINDOW_SECONDS);
    if (!byAddress.allowed) {
      res.setHeader('Retry-After', byAddress.resetSeconds);
      throw badRequest('Too many requests. Wait a moment and try again.', 'RATE_LIMITED');
    }

    const byClient = await consume(`embed:client:${clientId}`, PER_CLIENT_LIMIT, WINDOW_SECONDS);
    if (!byClient.allowed) {
      res.setHeader('Retry-After', byClient.resetSeconds);
      throw badRequest('This booking widget is busy. Try again shortly.', 'RATE_LIMITED');
    }

    next();
    return undefined;
  })
);

/**
 * Resolves the partner from a public client id.
 *
 * A revoked or suspended credential stops the widget working, which is the
 * only lever we have over an embed already pasted into someone's site.
 */
async function partnerFor(clientId: string) {
  const credential = await prisma.partnerCredential.findUnique({
    where: { clientId },
    include: { partner: true },
  });

  if (!credential || credential.revokedAt) {
    throw notFound('This booking widget is not configured.');
  }
  if (credential.partner.status !== 'ACTIVE') {
    throw notFound('This booking widget is not currently available.');
  }

  return { partner: credential.partner, isSandbox: credential.isSandbox };
}

async function diaryFor(isSandbox: boolean) {
  const doctor = isSandbox
    ? await prisma.doctor.findFirst({ where: { gmcNumber: 'SANDBOX' } })
    : await prisma.doctor.findFirst({ where: { isActive: true } });
  if (!doctor) throw notFound('No doctor is currently taking bookings.');
  return doctor;
}

/**
 * GET /api/embed/:clientId/config
 *
 * Everything the widget needs to render itself: the partner's colours and
 * name, and the consultation length. Deliberately returns nothing commercial:
 * the rate the partner pays us is none of the patient's business, and this
 * response is readable by anyone.
 */
embedRouter.get(
  '/:clientId/config',
  handle(async (req, res) => {
    const { partner, isSandbox } = await partnerFor(String(req.params.clientId));
    const settings = await getSettings();
    const doctor = await diaryFor(isSandbox);

    return ok(res, {
      displayName: partner.brandDisplayName,
      branding: {
        primaryColor: partner.brandPrimaryColor,
        accentColor: partner.brandAccentColor,
        fontFamily: partner.brandFontFamily,
        logoUrl: partner.brandLogoUrl,
      },
      durationMinutes: settings.consultationDuration,
      timezone: doctor.timezone,
      sandbox: isSandbox,
    });
  })
);

const availabilityQuery = z.object({
  days: z.coerce.number().min(1).max(30).default(14),
  timezone: z.string().min(1).default('Europe/London'),
});

/** GET /api/embed/:clientId/availability */
embedRouter.get(
  '/:clientId/availability',
  handle(async (req, res) => {
    const { days, timezone } = availabilityQuery.parse(req.query);
    const { isSandbox } = await partnerFor(String(req.params.clientId));
    const doctor = await diaryFor(isSandbox);
    const settings = await getSettings();

    const from = new Date();
    const slots = await schedulingProvider().getAvailability({
      doctorId: doctor.id,
      from,
      to: new Date(from.getTime() + days * 24 * 60 * 60 * 1000),
      durationMinutes: settings.consultationDuration,
    });

    // Grouped in the *patient's* zone, not the doctor's. Someone in Sydney
    // booking through an Australian partner should see Australian days.
    const byDate = new Map<string, Array<{ startsAt: string; endsAt: string }>>();
    for (const slot of slots) {
      let key: string;
      try {
        key = new Intl.DateTimeFormat('en-CA', {
          timeZone: timezone,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        }).format(slot.startsAt);
      } catch {
        throw badRequest('That is not a recognised timezone.', 'BAD_TIMEZONE');
      }
      const list = byDate.get(key) ?? [];
      list.push({ startsAt: slot.startsAt.toISOString(), endsAt: slot.endsAt.toISOString() });
      byDate.set(key, list);
    }

    return ok(res, {
      timezone,
      durationMinutes: settings.consultationDuration,
      days: [...byDate.entries()].map(([date, daySlots]) => ({ date, slots: daySlots })),
    });
  })
);

const holdBody = z.object({ startsAt: z.string().datetime() });

/** POST /api/embed/:clientId/holds */
embedRouter.post(
  '/:clientId/holds',
  handle(async (req, res) => {
    const { startsAt } = holdBody.parse(req.body);
    const { partner, isSandbox } = await partnerFor(String(req.params.clientId));
    const doctor = await diaryFor(isSandbox);
    const settings = await getSettings();

    const start = new Date(startsAt);
    if (start.getTime() <= Date.now()) {
      throw badRequest('That time has already passed.', 'SLOT_IN_PAST');
    }

    const held = await schedulingProvider().hold({
      doctorId: doctor.id,
      startsAt: start,
      endsAt: new Date(start.getTime() + settings.consultationDuration * 60_000),
      channel: 'PARTNER',
      partnerId: partner.id,
      holdMinutes: settings.slotHoldMinutes,
    });

    if (!held) throw conflict('That time has just been taken. Please choose another.', 'SLOT_TAKEN');

    return ok(res, {
      holdToken: held.holdToken,
      expiresAt: held.expiresAt.toISOString(),
      startsAt: held.startsAt.toISOString(),
      endsAt: held.endsAt.toISOString(),
    });
  })
);

const bookBody = z.object({
  holdToken: z.string().min(1),
  name: z.string().min(1, 'Tell us what to call you.').max(160),
  email: z.string().email('Enter a valid email address.'),
  phone: z.string().min(1, 'We need a phone number in case we cannot reach you by email.').max(40),
  timezone: z.string().min(1),
  reason: z.string().max(2000).optional(),
  consent: z.literal(true, {
    errorMap: () => ({ message: 'Consent is required before the appointment can be booked.' }),
  }),
});

/**
 * POST /api/embed/:clientId/bookings
 *
 * No payment. The partner took the money on their own side, which is what the
 * scope describes, so this writes amountPaid null and never touches Stripe.
 */
embedRouter.post(
  '/:clientId/bookings',
  handle(async (req, res) => {
    const input = bookBody.parse(req.body);
    const { partner, isSandbox } = await partnerFor(String(req.params.clientId));
    const doctor = await diaryFor(isSandbox);

    const hold = await prisma.slotHold.findUnique({ where: { holdToken: input.holdToken } });

    // Checked against this partner and this diary, not just existence.
    if (!hold || hold.partnerId !== partner.id || hold.doctorId !== doctor.id) {
      throw notFound('That time is no longer held. Please choose another.');
    }
    if (hold.bookingId) throw conflict('That hold has already been used.', 'HOLD_ALREADY_USED');
    if (hold.expiresAt <= new Date()) {
      throw conflict('Your held time has expired. Please choose another.', 'HOLD_EXPIRED');
    }

    const email = input.email.toLowerCase().trim();
    const patient = await prisma.patient.upsert({
      where: { email },
      update: { name: input.name, phone: input.phone, timezone: input.timezone },
      create: { email, name: input.name, phone: input.phone, timezone: input.timezone },
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
        paymentStatus: 'PAID',
        amountPaid: null,
        currency: partner.currency,
        startsAt: hold.startsAt,
        endsAt: hold.endsAt,
        patientTimezone: input.timezone,
      },
    });

    if (input.reason?.trim()) {
      await prisma.intakeResponse.create({
        data: {
          bookingId: booking.id,
          question: 'What would you like to discuss with the doctor?',
          answer: input.reason.trim(),
          position: 0,
        },
      });
    }

    // The consent wording is stored verbatim, the same as the direct flow. What
    // a patient agreed to has to be recoverable years later, and paraphrasing
    // it in a log is not the same thing.
    await prisma.consentRecord.create({
      data: {
        bookingId: booking.id,
        kind: 'TERMS_AND_DISCLAIMER',
        granted: true,
        wording: CONSENT_WORDING,
        ipAddress: req.ip ?? null,
        userAgent: req.headers['user-agent'] ?? null,
      },
    });

    await prisma.slotHold.update({
      where: { holdToken: hold.holdToken },
      data: { bookingId: booking.id },
    });

    await confirmBooking(booking.id, hold.holdToken);
    logger.info({ bookingId: booking.id, partner: partner.slug, isSandbox }, 'Embed booking');

    return ok(
      res,
      {
        reference: booking.reference,
        startsAt: booking.startsAt.toISOString(),
        endsAt: booking.endsAt.toISOString(),
        timezone: input.timezone,
      },
      undefined,
      201
    );
  })
);
