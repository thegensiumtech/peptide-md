import { Router } from 'express';
import { z } from 'zod';
import { prisma, type Prisma } from '@peptide/database';
import { conflict, forbidden, handle, notFound, ok } from '../../http/errors';
import { requireAuth, requireRole } from '../../http/middleware/auth';
import { cancelBooking, getSettings, rescheduleBooking } from '../bookings/service';
import { cacheDelete } from '../../lib/redis';

export const adminRouter = Router();

adminRouter.use(requireAuth, requireRole('ADMIN', 'DOCTOR'));

/** The doctor sees his own diary; the administrator sees the business. */
const isDoctor = (role: string) => role === 'DOCTOR';

function serialiseBooking(booking: Prisma.BookingGetPayload<{
  include: { patient: true; partner: true; intakeResponses: true };
}>, hideCommercial: boolean) {
  return {
    id: booking.id,
    reference: booking.reference,
    channel: booking.channel.toLowerCase(),
    partnerId: booking.partnerId,
    partnerName: booking.partner?.name ?? null,
    status: booking.status.toLowerCase(),
    paymentStatus: booking.paymentStatus.toLowerCase(),
    startsAt: booking.startsAt.toISOString(),
    endsAt: booking.endsAt.toISOString(),
    patientTimezone: booking.patientTimezone,
    patientName: booking.patient.name,
    patientEmail: booking.patient.email,
    patientPhone: booking.patient.phone,
    intake: booking.intakeResponses
      .sort((a, b) => a.position - b.position)
      .map((r) => ({ question: r.question, answer: r.answer })),
    // Money is commercial, not clinical — the doctor role never receives it.
    amountPaid: hideCommercial ? null : booking.amountPaid,
    currency: booking.currency,
    joiningUrl: booking.joiningUrl,
    createdAt: booking.createdAt.toISOString(),
    cancelledAt: booking.cancelledAt?.toISOString() ?? null,
    cancellationReason: booking.cancellationReason,
  };
}

const listQuery = z.object({
  channel: z.enum(['direct', 'partner', 'all']).default('all'),
  status: z
    .enum(['pending_payment', 'confirmed', 'cancelled', 'completed', 'no_show', 'all'])
    .default('all'),
  partnerId: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  search: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(25),
});

adminRouter.get(
  '/bookings',
  handle(async (req, res) => {
    const query = listQuery.parse(req.query);
    const where: Prisma.BookingWhereInput = {};

    if (query.channel !== 'all') where.channel = query.channel.toUpperCase() as 'DIRECT' | 'PARTNER';
    if (query.status !== 'all') where.status = query.status.toUpperCase() as never;
    if (query.partnerId) where.partnerId = query.partnerId;
    if (query.from || query.to) {
      where.startsAt = {
        ...(query.from ? { gte: new Date(`${query.from}T00:00:00.000Z`) } : {}),
        ...(query.to ? { lte: new Date(`${query.to}T23:59:59.999Z`) } : {}),
      };
    }
    if (query.search) {
      where.OR = [
        { reference: { contains: query.search, mode: 'insensitive' } },
        { patient: { name: { contains: query.search, mode: 'insensitive' } } },
        { patient: { email: { contains: query.search, mode: 'insensitive' } } },
      ];
    }

    const [rows, total] = await Promise.all([
      prisma.booking.findMany({
        where,
        include: { patient: true, partner: true, intakeResponses: true },
        orderBy: { startsAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      prisma.booking.count({ where }),
    ]);

    return ok(
      res,
      rows.map((row) => serialiseBooking(row, isDoctor(req.user!.role))),
      { total, page: query.page, limit: query.limit }
    );
  })
);

adminRouter.get(
  '/bookings/:id',
  handle(async (req, res) => {
    const booking = await prisma.booking.findUnique({
      where: { id: req.params.id! },
      include: { patient: true, partner: true, intakeResponses: true },
    });
    if (!booking) throw notFound('That booking could not be found.');
    return ok(res, serialiseBooking(booking, isDoctor(req.user!.role)));
  })
);

const cancelInput = z.object({
  reason: z.string().min(1, 'Give a reason — it goes in the patient’s email.'),
  refund: z.boolean().default(true),
});

adminRouter.post(
  '/bookings/:id/cancel',
  requireRole('ADMIN'),
  handle(async (req, res) => {
    const input = cancelInput.parse(req.body);
    await cancelBooking({
      bookingId: req.params.id!,
      reason: input.reason,
      cancelledBy: req.user!.sub,
      refund: input.refund,
    });
    return ok(res, { cancelled: true });
  })
);

const rescheduleInput = z.object({ startsAt: z.string().datetime() });

adminRouter.post(
  '/bookings/:id/reschedule',
  requireRole('ADMIN'),
  handle(async (req, res) => {
    const { startsAt } = rescheduleInput.parse(req.body);
    const settings = await getSettings();
    const start = new Date(startsAt);
    await rescheduleBooking(
      req.params.id!,
      start,
      new Date(start.getTime() + settings.consultationDuration * 60_000)
    );
    return ok(res, { rescheduled: true });
  })
);

// --- Dashboard ---------------------------------------------------------------

adminRouter.get(
  '/dashboard',
  handle(async (req, res) => {
    const now = new Date();
    const period = now.toISOString().slice(0, 7);
    const monthStart = new Date(`${period}-01T00:00:00.000Z`);

    const [upcomingCount, monthBookings, partners] = await Promise.all([
      prisma.booking.count({ where: { status: 'CONFIRMED', startsAt: { gte: now } } }),
      prisma.booking.findMany({
        where: { startsAt: { gte: monthStart }, status: { not: 'CANCELLED' } },
        select: { channel: true, partnerId: true, amountPaid: true, paymentStatus: true },
      }),
      prisma.partner.findMany({ select: { id: true, name: true, ratePerAppointment: true } }),
    ]);

    const direct = monthBookings.filter((b) => b.channel === 'DIRECT').length;
    const partner = monthBookings.filter((b) => b.channel === 'PARTNER').length;

    const rateOf = new Map(partners.map((p) => [p.id, p.ratePerAppointment]));
    const billableThisMonth = monthBookings
      .filter((b) => b.channel === 'PARTNER' && b.partnerId)
      .reduce((sum, b) => sum + (rateOf.get(b.partnerId!) ?? 0), 0);

    const directRevenueThisMonth = monthBookings
      .filter((b) => b.channel === 'DIRECT' && b.paymentStatus === 'PAID')
      .reduce((sum, b) => sum + (b.amountPaid ?? 0), 0);

    return ok(res, {
      upcomingCount,
      monthVolume: { period, direct, partner, total: direct + partner },
      billableThisMonth: isDoctor(req.user!.role) ? 0 : billableThisMonth,
      directRevenueThisMonth: isDoctor(req.user!.role) ? 0 : directRevenueThisMonth,
      currency: 'GBP',
    });
  })
);

// --- Doctor profile and availability ----------------------------------------

adminRouter.get(
  '/doctor',
  handle(async (_req, res) => {
    const doctor = await prisma.doctor.findFirst({
      where: { isActive: true },
      include: { availabilityWindows: true, availabilityOverrides: true },
    });
    if (!doctor) throw notFound('No doctor record found.');

    return ok(res, {
      id: doctor.id,
      name: doctor.name,
      credentials: doctor.credentials,
      gmcNumber: doctor.gmcNumber,
      photoUrl: doctor.photoUrl,
      headline: doctor.headline,
      bio: doctor.bio,
      specialisms: doctor.specialisms,
      languages: doctor.languages,
      timezone: doctor.timezone,
      availability: {
        timezone: doctor.timezone,
        weekly: doctor.availabilityWindows.map((w) => ({
          id: w.id,
          day: w.day.toLowerCase(),
          startTime: w.startTime,
          endTime: w.endTime,
        })),
        overrides: doctor.availabilityOverrides.map((o) => ({
          id: o.id,
          date: o.date.toISOString().slice(0, 10),
          kind: o.kind.toLowerCase(),
          startTime: o.startTime,
          endTime: o.endTime,
          note: o.note,
        })),
      },
    });
  })
);

const doctorUpdate = z.object({
  name: z.string().min(1),
  credentials: z.string(),
  gmcNumber: z.string().min(1),
  headline: z.string(),
  bio: z.string(),
  specialisms: z.array(z.string()),
  languages: z.array(z.string()),
  timezone: z.string(),
});

adminRouter.put(
  '/doctor/:id',
  handle(async (req, res) => {
    const input = doctorUpdate.parse(req.body);
    // A doctor may edit only their own record.
    if (isDoctor(req.user!.role) && req.user!.doctorId !== req.params.id) {
      throw forbidden('You can only edit your own profile.');
    }
    const doctor = await prisma.doctor.update({ where: { id: req.params.id! }, data: input });
    await cacheDelete(`availability:${doctor.id}:*`);
    return ok(res, { id: doctor.id });
  })
);

const availabilityUpdate = z.object({
  weekly: z.array(
    z.object({
      day: z.enum(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']),
      startTime: z.string().regex(/^\d{2}:\d{2}$/),
      endTime: z.string().regex(/^\d{2}:\d{2}$/),
    })
  ),
  overrides: z.array(
    z.object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      kind: z.enum(['blocked', 'extra']),
      startTime: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
      endTime: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
      note: z.string().default(''),
    })
  ),
});

adminRouter.put(
  '/doctor/:id/availability',
  handle(async (req, res) => {
    const input = availabilityUpdate.parse(req.body);
    const doctorId = req.params.id!;

    if (isDoctor(req.user!.role) && req.user!.doctorId !== doctorId) {
      throw forbidden('You can only change your own availability.');
    }

    // Replace wholesale inside a transaction: a half-applied pattern would
    // offer times the doctor has not agreed to.
    await prisma.$transaction([
      prisma.availabilityWindow.deleteMany({ where: { doctorId } }),
      prisma.availabilityOverride.deleteMany({ where: { doctorId } }),
      prisma.availabilityWindow.createMany({
        data: input.weekly.map((w) => ({
          doctorId,
          day: w.day.toUpperCase() as never,
          startTime: w.startTime,
          endTime: w.endTime,
        })),
      }),
      prisma.availabilityOverride.createMany({
        data: input.overrides.map((o) => ({
          doctorId,
          date: new Date(o.date),
          kind: o.kind.toUpperCase() as never,
          startTime: o.startTime,
          endTime: o.endTime,
          note: o.note,
        })),
      }),
    ]);

    // A change here must apply to this website and every partner site at once.
    await cacheDelete(`availability:${doctorId}:*`);
    return ok(res, { updated: true });
  })
);

// --- Settings ----------------------------------------------------------------

adminRouter.get(
  '/settings',
  requireRole('ADMIN'),
  handle(async (_req, res) => {
    const settings = await getSettings();
    return ok(res, {
      consultation: {
        priceAmount: settings.consultationPrice,
        currency: settings.consultationCurrency,
        durationMinutes: settings.consultationDuration,
        summary: settings.consultationSummary,
        inclusions: settings.consultationInclusions,
        deliveryNote: settings.deliveryNote,
      },
      partnerDefaults: {
        defaultRatePerAppointment: settings.defaultPartnerRate,
        currency: settings.consultationCurrency,
        slotHoldMinutes: settings.slotHoldMinutes,
        defaultRateLimitPerMinute: settings.defaultRateLimitPerMin,
      },
      notifications: {
        fromName: settings.emailFromName,
        fromEmail: settings.emailFromAddress,
        reminderLeadHours: settings.reminderLeadHours,
        notifyDoctorOnBooking: settings.notifyDoctorOnBooking,
        notifyDoctorOnCancellation: settings.notifyDoctorOnCancellation,
      },
    });
  })
);

const settingsUpdate = z.object({
  consultationPrice: z.number().int().min(0),
  consultationDuration: z.number().int().min(5),
  consultationSummary: z.string(),
  consultationInclusions: z.array(z.string()),
  deliveryNote: z.string(),
  defaultPartnerRate: z.number().int().min(0),
  slotHoldMinutes: z.number().int().min(1),
  defaultRateLimitPerMin: z.number().int().min(1),
  emailFromName: z.string(),
  emailFromAddress: z.string().email(),
  reminderLeadHours: z.number().int().min(1),
  notifyDoctorOnBooking: z.boolean(),
  notifyDoctorOnCancellation: z.boolean(),
});

adminRouter.put(
  '/settings',
  requireRole('ADMIN'),
  handle(async (req, res) => {
    const input = settingsUpdate.parse(req.body);
    const before = await getSettings();

    const updated = await prisma.platformSettings.update({ where: { id: 'singleton' }, data: input });

    // Price changes are commercially meaningful, so they are recorded rather
    // than merely applied.
    await prisma.auditEvent.create({
      data: {
        userId: req.user!.sub,
        action: 'settings.update',
        entityType: 'PlatformSettings',
        entityId: 'singleton',
        before: { price: before.consultationPrice, partnerRate: before.defaultPartnerRate },
        after: { price: updated.consultationPrice, partnerRate: updated.defaultPartnerRate },
        ipAddress: req.ip ?? null,
      },
    });

    return ok(res, { updated: true });
  })
);

// --- The doctor's diary ------------------------------------------------------

const diaryQuery = z.object({
  from: z.string().optional(),
  days: z.coerce.number().min(1).max(31).default(7),
});

/**
 * Every slot the doctor's pattern produces, each labelled with its state.
 *
 * This is the opposite question to /booking/availability, which answers "what
 * can a patient book?". Both read the same grid, so the diary and the public
 * calendar can never disagree about where the slots are.
 */
adminRouter.get(
  '/doctor/:id/diary',
  handle(async (req, res) => {
    const { from, days } = diaryQuery.parse(req.query);
    const doctorId = req.params.id!;

    if (isDoctor(req.user!.role) && req.user!.doctorId !== doctorId) {
      throw forbidden('You can only see your own diary.');
    }

    const settings = await getSettings();
    const start = from ? new Date(`${from}T00:00:00.000Z`) : new Date();
    const end = new Date(start.getTime() + days * 24 * 60 * 60 * 1000);

    const { buildSlotGrid } = await import('../../scheduling/internal');
    const [grid, bookings, holds, doctor] = await Promise.all([
      buildSlotGrid(doctorId, start, end, settings.consultationDuration),
      prisma.booking.findMany({
        where: {
          doctorId,
          status: { in: ['CONFIRMED', 'COMPLETED', 'NO_SHOW'] },
          startsAt: { gte: start, lte: end },
        },
        include: { patient: true, partner: true },
      }),
      prisma.slotHold.findMany({
        where: { doctorId, releasedAt: null, expiresAt: { gt: new Date() }, startsAt: { gte: start, lte: end } },
      }),
      prisma.doctor.findUnique({ where: { id: doctorId }, select: { timezone: true } }),
    ]);

    const byDay = new Map<string, unknown[]>();

    for (const slot of grid) {
      const booking = bookings.find((b) => b.startsAt.getTime() === slot.startsAt.getTime());
      const held = holds.some((h) => h.startsAt.getTime() === slot.startsAt.getTime());

      // A booked slot outranks a block: if a patient is coming, that is the
      // fact the doctor needs to see, whatever the pattern says.
      const state = booking ? 'booked' : held ? 'held' : slot.blockedByOverride ? 'blocked' : 'free';

      const key = slot.startsAt.toISOString().slice(0, 10);
      const list = byDay.get(key) ?? [];
      list.push({
        startsAt: slot.startsAt.toISOString(),
        endsAt: slot.endsAt.toISOString(),
        state,
        booking: booking
          ? {
              id: booking.id,
              reference: booking.reference,
              patientName: booking.patient.name,
              channel: booking.channel.toLowerCase(),
              partnerName: booking.partner?.name ?? null,
            }
          : null,
      });
      byDay.set(key, list);
    }

    return ok(res, {
      timezone: doctor?.timezone ?? 'Europe/London',
      durationMinutes: settings.consultationDuration,
      days: [...byDay.entries()].map(([date, slots]) => ({ date, slots })),
    });
  })
);

const toggleSlot = z.object({
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
});

/**
 * Block or unblock one slot.
 *
 * Deliberately one tap rather than a form. The whole in-house approach rests
 * on the doctor actually marking time as busy; if it takes a dialog he will
 * not bother, and a patient books over his afternoon.
 */
adminRouter.post(
  '/doctor/:id/slots/toggle',
  handle(async (req, res) => {
    const { startsAt, endsAt } = toggleSlot.parse(req.body);
    const doctorId = req.params.id!;

    if (isDoctor(req.user!.role) && req.user!.doctorId !== doctorId) {
      throw forbidden('You can only change your own diary.');
    }

    const start = new Date(startsAt);
    const end = new Date(endsAt);

    // A booked slot can never be blocked out from under the patient.
    const booked = await prisma.booking.findFirst({
      where: {
        doctorId,
        status: { in: ['CONFIRMED', 'COMPLETED', 'NO_SHOW'] },
        startsAt: { lt: end },
        endsAt: { gt: start },
      },
      select: { reference: true },
    });
    if (booked) {
      throw conflict(
        `A patient is booked at that time (${booked.reference}). Cancel the appointment first.`,
        'SLOT_BOOKED'
      );
    }

    const doctor = await prisma.doctor.findUnique({ where: { id: doctorId } });
    if (!doctor) throw notFound('Doctor not found.');

    // Times on the override are stored in the doctor's own zone, matching how
    // the weekly pattern is expressed.
    const local = new Intl.DateTimeFormat('en-GB', {
      timeZone: doctor.timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const startTime = local.format(start);
    const endTime = local.format(end);
    const dateKey = new Intl.DateTimeFormat('en-CA', { timeZone: doctor.timezone }).format(start);

    const existing = await prisma.availabilityOverride.findFirst({
      where: {
        doctorId,
        kind: 'BLOCKED',
        date: new Date(`${dateKey}T00:00:00.000Z`),
        startTime,
        endTime,
      },
    });

    let blocked: boolean;
    if (existing) {
      await prisma.availabilityOverride.delete({ where: { id: existing.id } });
      blocked = false;
    } else {
      await prisma.availabilityOverride.create({
        data: {
          doctorId,
          date: new Date(`${dateKey}T00:00:00.000Z`),
          kind: 'BLOCKED',
          startTime,
          endTime,
          note: 'Blocked from the diary',
        },
      });
      blocked = true;
    }

    // Applies to this website and every partner site at once.
    await cacheDelete(`availability:${doctorId}:*`);

    return ok(res, { blocked, startsAt, endsAt });
  })
);
