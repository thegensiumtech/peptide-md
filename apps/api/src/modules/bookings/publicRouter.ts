import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { prisma } from '@peptide/database';
import { badRequest, conflict, handle, notFound, ok } from '../../http/errors';
import { schedulingProvider } from '../../scheduling';
import { createCheckoutSession } from '../../payments/stripe';
import { cacheGet, cacheSet } from '../../lib/redis';
import { getSettings, nextReference } from './service';

export const publicBookingRouter = Router();

/** Unauthenticated and public, so it is rate limited per IP. */
const publicLimiter = rateLimit({ windowMs: 60_000, limit: 60, standardHeaders: true, legacyHeaders: false });
publicBookingRouter.use(publicLimiter);

async function activeDoctor() {
  const doctor = await prisma.doctor.findFirst({ where: { isActive: true } });
  if (!doctor) throw notFound('No doctor is currently taking bookings.');
  return doctor;
}

/** What the consultation is and costs. Drives the details screen. */
publicBookingRouter.get(
  '/consultation',
  handle(async (_req, res) => {
    const [settings, doctor] = await Promise.all([getSettings(), activeDoctor()]);
    return ok(res, {
      priceAmount: settings.consultationPrice,
      currency: settings.consultationCurrency,
      durationMinutes: settings.consultationDuration,
      summary: settings.consultationSummary,
      inclusions: settings.consultationInclusions,
      deliveryNote: settings.deliveryNote,
      doctor: {
        id: doctor.id,
        name: doctor.name,
        credentials: doctor.credentials,
        gmcNumber: doctor.gmcNumber,
        headline: doctor.headline,
        bio: doctor.bio,
        specialisms: doctor.specialisms,
        languages: doctor.languages,
        photoUrl: doctor.photoUrl,
        timezone: doctor.timezone,
      },
    });
  })
);

const availabilityQuery = z.object({
  from: z.string().datetime().optional(),
  days: z.coerce.number().min(1).max(60).default(21),
});

/**
 * Free slots. Cached briefly — availability is read on every page view of the
 * slot screen but only changes when someone books, holds or the doctor edits
 * their pattern, all of which bust the key.
 */
publicBookingRouter.get(
  '/availability',
  handle(async (req, res) => {
    const { from, days } = availabilityQuery.parse(req.query);
    const [settings, doctor] = await Promise.all([getSettings(), activeDoctor()]);

    const start = from ? new Date(from) : new Date();
    const end = new Date(start.getTime() + days * 24 * 60 * 60 * 1000);
    const cacheKey = `availability:${doctor.id}:${start.toISOString().slice(0, 13)}:${days}`;

    const cached = await cacheGet(cacheKey);
    if (cached) return ok(res, JSON.parse(cached));

    const slots = await schedulingProvider().getAvailability({
      doctorId: doctor.id,
      from: start,
      to: end,
      durationMinutes: settings.consultationDuration,
    });

    // Grouped by the doctor's calendar day; the browser renders them in the
    // patient's own zone.
    const byDay = new Map<string, Array<{ startsAt: string; endsAt: string }>>();
    for (const slot of slots) {
      const key = slot.startsAt.toISOString().slice(0, 10);
      const list = byDay.get(key) ?? [];
      list.push({ startsAt: slot.startsAt.toISOString(), endsAt: slot.endsAt.toISOString() });
      byDay.set(key, list);
    }

    const payload = {
      timezone: doctor.timezone,
      durationMinutes: settings.consultationDuration,
      days: [...byDay.entries()].map(([date, daySlots]) => ({ date, slots: daySlots })),
    };

    await cacheSet(cacheKey, JSON.stringify(payload), 60);
    return ok(res, payload);
  })
);

const startCheckout = z.object({
  patientEmail: z.string().email('Enter a valid email address.'),
});

/**
 * Step one of the money path: create the booking in PENDING_PAYMENT and hand
 * back a Stripe Checkout URL. No slot is held yet — payment comes first, so a
 * failed or abandoned checkout can never leave a time in limbo.
 */
publicBookingRouter.post(
  '/checkout',
  handle(async (req, res) => {
    const { patientEmail } = startCheckout.parse(req.body);
    const [settings, doctor] = await Promise.all([getSettings(), activeDoctor()]);

    const email = patientEmail.toLowerCase().trim();
    const patient = await prisma.patient.upsert({
      where: { email },
      update: {},
      create: { email, name: 'Pending', phone: '', timezone: 'Europe/London' },
    });

    const reference = await nextReference();
    const placeholder = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const booking = await prisma.booking.create({
      data: {
        reference,
        doctorId: doctor.id,
        patientId: patient.id,
        channel: 'DIRECT',
        status: 'PENDING_PAYMENT',
        paymentStatus: 'UNPAID',
        // Real times are set once the patient picks a slot, after payment.
        startsAt: placeholder,
        endsAt: new Date(placeholder.getTime() + settings.consultationDuration * 60_000),
        patientTimezone: 'Europe/London',
        currency: settings.consultationCurrency,
      },
    });

    const session = await createCheckoutSession({
      bookingId: booking.id,
      reference: booking.reference,
      amount: settings.consultationPrice,
      currency: settings.consultationCurrency,
      patientEmail: email,
      consultationName: 'Peptide MD consultation',
      durationMinutes: settings.consultationDuration,
    });

    await prisma.payment.create({
      data: {
        bookingId: booking.id,
        stripeSessionId: session.id,
        amount: settings.consultationPrice,
        currency: settings.consultationCurrency,
        type: 'CHECKOUT_CREATED',
      },
    });

    return ok(res, {
      bookingId: booking.id,
      reference: booking.reference,
      checkoutUrl: session.url,
      sessionId: session.id,
    });
  }, ),
);

const verifyPayment = z.object({
  bookingId: z.string().min(1),
  sessionId: z.string().min(1),
});

/**
 * Confirm payment on return from Checkout.
 *
 * The webhook remains the primary path and the only one that can be relied on
 * — the patient may close the tab before ever coming back. This is the second
 * path, for when they do return before the webhook has landed.
 *
 * It is not trusting the browser: the browser supplies a session id and the
 * server asks Stripe directly what that session's payment status is. A forged
 * id simply fails to resolve.
 */
publicBookingRouter.post(
  '/verify-payment',
  handle(async (req, res) => {
    const { bookingId, sessionId } = verifyPayment.parse(req.body);

    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking) throw notFound('That booking could not be found.');

    // Already settled by the webhook — nothing to do.
    if (booking.paymentStatus === 'PAID') {
      return ok(res, { paymentStatus: 'paid', alreadyConfirmed: true });
    }

    const { stripe } = await import('../../payments/stripe');

    // An unknown or malformed session id is someone probing, not a server
    // fault. Stripe throws on it, so it is caught and answered as a plain
    // refusal rather than surfacing a 500 with internal detail attached.
    let session;
    try {
      session = await stripe.checkout.sessions.retrieve(sessionId);
    } catch {
      throw badRequest('That payment could not be found.', 'PAYMENT_NOT_FOUND');
    }

    // The session must belong to this booking. Without this a real receipt
    // could be replayed against a second, unpaid booking.
    if (session.metadata?.bookingId !== bookingId) {
      throw badRequest('That payment does not belong to this booking.', 'PAYMENT_MISMATCH');
    }

    if (session.payment_status !== 'paid') {
      return ok(res, { paymentStatus: session.payment_status, alreadyConfirmed: false });
    }

    await prisma.booking.update({
      where: { id: bookingId },
      data: { paymentStatus: 'PAID', amountPaid: session.amount_total ?? null },
    });

    const { recordSuccessfulPayment } = await import('./service');
    await recordSuccessfulPayment({
      bookingId,
      paymentIntentId: typeof session.payment_intent === 'string' ? session.payment_intent : null,
      amount: session.amount_total ?? 0,
      currency: (session.currency ?? 'gbp').toUpperCase(),
    });

    return ok(res, { paymentStatus: 'paid', alreadyConfirmed: false });
  })
);

const holdRequest = z.object({
  bookingId: z.string().min(1),
  startsAt: z.string().datetime(),
  timezone: z.string().min(1),
});

/**
 * Step two: hold the chosen time. Only reachable once payment is confirmed —
 * the booking must already be PAID, which only the webhook can set.
 */
publicBookingRouter.post(
  '/hold',
  handle(async (req, res) => {
    const { bookingId, startsAt, timezone } = holdRequest.parse(req.body);
    const settings = await getSettings();

    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking) throw notFound('That booking could not be found.');
    if (booking.paymentStatus !== 'PAID') {
      throw badRequest('This booking has not been paid for yet.', 'PAYMENT_REQUIRED');
    }

    const start = new Date(startsAt);
    const end = new Date(start.getTime() + settings.consultationDuration * 60_000);

    const held = await schedulingProvider().hold({
      doctorId: booking.doctorId,
      startsAt: start,
      endsAt: end,
      channel: 'DIRECT',
      holdMinutes: settings.slotHoldMinutes,
    });

    // Lost the race: someone on another channel took it a moment earlier.
    if (!held) throw conflict('That time has just been taken. Please choose another.', 'SLOT_TAKEN');

    await prisma.slotHold.update({
      where: { holdToken: held.holdToken },
      data: { bookingId: booking.id },
    });

    await prisma.booking.update({
      where: { id: booking.id },
      data: { startsAt: held.startsAt, endsAt: held.endsAt, patientTimezone: timezone },
    });

    return ok(res, {
      holdToken: held.holdToken,
      expiresAt: held.expiresAt.toISOString(),
      startsAt: held.startsAt.toISOString(),
      endsAt: held.endsAt.toISOString(),
    });
  })
);

const intakeSubmission = z.object({
  bookingId: z.string().min(1),
  holdToken: z.string().min(1),
  name: z.string().min(1, 'Tell us what to call you.'),
  email: z.string().email('Enter a valid email address.'),
  phone: z.string().min(1, 'We need a phone number in case we cannot reach you by email.'),
  timezone: z.string().min(1),
  answers: z
    .array(z.object({ question: z.string().min(1), answer: z.string().min(1) }))
    .min(1, 'Answer the intake questions.'),
  consentClinical: z.literal(true, {
    errorMap: () => ({ message: 'Consent to the clinical record is required.' }),
  }),
  consentTerms: z.literal(true, {
    errorMap: () => ({ message: 'You must accept the terms and the medical disclaimer.' }),
  }),
});

/** Step three: intake, consent, and confirmation of the held slot. */
publicBookingRouter.post(
  '/intake',
  handle(async (req, res) => {
    const input = intakeSubmission.parse(req.body);

    const booking = await prisma.booking.findUnique({ where: { id: input.bookingId } });
    if (!booking) throw notFound('That booking could not be found.');
    if (booking.paymentStatus !== 'PAID') {
      throw badRequest('This booking has not been paid for yet.', 'PAYMENT_REQUIRED');
    }

    const hold = await prisma.slotHold.findUnique({ where: { holdToken: input.holdToken } });
    if (!hold || hold.expiresAt < new Date()) {
      throw conflict('Your held time has expired. Please choose another.', 'HOLD_EXPIRED');
    }

    await prisma.patient.update({
      where: { id: booking.patientId },
      data: { name: input.name, phone: input.phone, timezone: input.timezone },
    });

    await prisma.intakeResponse.deleteMany({ where: { bookingId: booking.id } });
    await prisma.intakeResponse.createMany({
      data: input.answers.map((answer, position) => ({
        bookingId: booking.id,
        question: answer.question,
        answer: answer.answer,
        position,
      })),
    });

    // Consent is recorded with the exact wording agreed to, so it stays
    // provable if the wording later changes.
    await prisma.consentRecord.createMany({
      data: [
        {
          bookingId: booking.id,
          kind: 'CLINICAL_RECORD',
          granted: true,
          wording:
            'I consent to Dr Hartley recording and holding these answers as part of my clinical record.',
          ipAddress: req.ip ?? null,
          userAgent: req.headers['user-agent'] ?? null,
        },
        {
          bookingId: booking.id,
          kind: 'TERMS_AND_DISCLAIMER',
          granted: true,
          wording:
            'I have read the terms and the medical disclaimer, and understand this is not a prescribing service.',
          ipAddress: req.ip ?? null,
          userAgent: req.headers['user-agent'] ?? null,
        },
      ],
    });

    const { confirmBooking } = await import('./service');
    await confirmBooking(booking.id, input.holdToken);

    const confirmed = await prisma.booking.findUnique({
      where: { id: booking.id },
      include: { doctor: true },
    });

    return ok(res, {
      reference: confirmed!.reference,
      startsAt: confirmed!.startsAt.toISOString(),
      endsAt: confirmed!.endsAt.toISOString(),
      timezone: confirmed!.patientTimezone,
      doctorName: confirmed!.doctor.name,
      status: confirmed!.status.toLowerCase(),
    });
  })
);

/** Lets the slot screen recover state after the Stripe redirect. */
publicBookingRouter.get(
  '/status/:bookingId',
  handle(async (req, res) => {
    const booking = await prisma.booking.findUnique({
      where: { id: req.params.bookingId! },
      include: { doctor: true },
    });
    if (!booking) throw notFound('That booking could not be found.');

    return ok(res, {
      bookingId: booking.id,
      reference: booking.reference,
      status: booking.status.toLowerCase(),
      paymentStatus: booking.paymentStatus.toLowerCase(),
      startsAt: booking.startsAt.toISOString(),
      timezone: booking.patientTimezone,
      doctorName: booking.doctor.name,
    });
  })
);
