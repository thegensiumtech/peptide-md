import { randomBytes } from 'node:crypto';
import { Prisma, prisma, type Weekday } from '@peptide/database';
import { logger } from '../logger';
import { cacheDelete } from '../lib/redis';
import type {
  AvailabilityQuery,
  ConfirmRequest,
  ConfirmedBooking,
  HeldSlot,
  HoldRequest,
  SchedulingProvider,
  TimeSlot,
} from './provider';

const WEEKDAYS: Weekday[] = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
];

/** Minutes from midnight for an 'HH:mm' string. */
function toMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return (hours ?? 0) * 60 + (minutes ?? 0);
}

/**
 * The offset, in minutes, that a zone is ahead of UTC at a given instant.
 * Derived from Intl rather than a hardcoded table so British Summer Time and
 * the Australian transitions are handled without a timezone dependency.
 */
function zoneOffsetMinutes(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(instant);

  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? '0');
  const asUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour') === 24 ? 0 : get('hour'),
    get('minute'),
    get('second')
  );
  return (asUtc - instant.getTime()) / 60_000;
}

/** Turn a doctor-local calendar date and time into the correct UTC instant. */
function localToUtc(date: Date, minutesFromMidnight: number, timeZone: string): Date {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth();
  const d = date.getUTCDate();
  const naive = Date.UTC(y, m, d, 0, minutesFromMidnight);
  // Two passes: the offset itself depends on the instant, and one correction
  // is enough for every real transition.
  const first = new Date(naive - zoneOffsetMinutes(new Date(naive), timeZone) * 60_000);
  return new Date(naive - zoneOffsetMinutes(first, timeZone) * 60_000);
}

function sameLocalDate(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

function overlaps(a: TimeSlot, b: TimeSlot): boolean {
  return a.startsAt < b.endsAt && b.startsAt < a.endsAt;
}

/**
 * The full slot grid for a doctor, with nothing removed.
 *
 * `getAvailability` answers "what can a patient book?" and so drops anything
 * blocked or taken. The doctor's diary needs the opposite: every slot his
 * pattern produces, each labelled with why it is or is not free. Both are
 * generated here so the two views can never disagree about where the slots
 * are.
 */
export async function buildSlotGrid(
  doctorId: string,
  from: Date,
  to: Date,
  durationMinutes: number
): Promise<Array<{ startsAt: Date; endsAt: Date; blockedByOverride: boolean }>> {
  const doctor = await prisma.doctor.findUnique({
    where: { id: doctorId },
    include: { availabilityWindows: true, availabilityOverrides: true },
  });
  if (!doctor) return [];

  const zone = doctor.timezone;
  const grid: Array<{ startsAt: Date; endsAt: Date; blockedByOverride: boolean }> = [];

  const cursor = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));

  while (cursor <= to) {
    const dayOfWeek = WEEKDAYS[(cursor.getUTCDay() + 6) % 7]!;
    const overridesToday = doctor.availabilityOverrides.filter((o) =>
      sameLocalDate(new Date(o.date), cursor)
    );
    const wholeDayBlocked = overridesToday.some((o) => o.kind === 'BLOCKED' && !o.startTime);

    const windows = [
      ...doctor.availabilityWindows.filter((w) => w.day === dayOfWeek),
      ...overridesToday
        .filter((o) => o.kind === 'EXTRA' && o.startTime && o.endTime)
        .map((o) => ({ startTime: o.startTime!, endTime: o.endTime! })),
    ];

    const blockedWindows = overridesToday.filter(
      (o) => o.kind === 'BLOCKED' && o.startTime && o.endTime
    );

    for (const window of windows) {
      let minute = toMinutes(window.startTime);
      const end = toMinutes(window.endTime);

      while (minute + durationMinutes <= end) {
        const startsAt = localToUtc(cursor, minute, zone);
        const endsAt = new Date(startsAt.getTime() + durationMinutes * 60_000);

        if (startsAt >= from && startsAt <= to) {
          const inBlockedWindow = blockedWindows.some((b) =>
            overlaps(
              { startsAt, endsAt },
              {
                startsAt: localToUtc(cursor, toMinutes(b.startTime!), zone),
                endsAt: localToUtc(cursor, toMinutes(b.endTime!), zone),
              }
            )
          );
          grid.push({ startsAt, endsAt, blockedByOverride: wholeDayBlocked || inBlockedWindow });
        }
        minute += durationMinutes;
      }
    }

    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  grid.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  return grid;
}

/**
 * Postgres-backed scheduling.
 *
 * Runs the whole booking flow before the Cal.com account exists, and stays as
 * the fallback afterwards. Availability is the weekly pattern, plus extra
 * sessions, minus blocked dates, minus live holds, minus booked time.
 */
export class InternalSchedulingProvider implements SchedulingProvider {
  readonly name = 'internal' as const;

  async getAvailability(query: AvailabilityQuery): Promise<TimeSlot[]> {
    const doctor = await prisma.doctor.findUnique({
      where: { id: query.doctorId },
      include: { availabilityWindows: true, availabilityOverrides: true },
    });
    if (!doctor) return [];

    const zone = doctor.timezone;
    const now = new Date();
    const slots: TimeSlot[] = [];

    const cursor = new Date(
      Date.UTC(query.from.getUTCFullYear(), query.from.getUTCMonth(), query.from.getUTCDate())
    );

    while (cursor <= query.to) {
      const dayOfWeek = WEEKDAYS[(cursor.getUTCDay() + 6) % 7]!;

      const overridesToday = doctor.availabilityOverrides.filter((o) =>
        sameLocalDate(new Date(o.date), cursor)
      );

      const wholeDayBlocked = overridesToday.some((o) => o.kind === 'BLOCKED' && !o.startTime);

      if (!wholeDayBlocked) {
        const windows = [
          ...doctor.availabilityWindows.filter((w) => w.day === dayOfWeek),
          ...overridesToday
            .filter((o) => o.kind === 'EXTRA' && o.startTime && o.endTime)
            .map((o) => ({ startTime: o.startTime!, endTime: o.endTime! })),
        ];

        const blockedWindows = overridesToday.filter(
          (o) => o.kind === 'BLOCKED' && o.startTime && o.endTime
        );

        for (const window of windows) {
          let minute = toMinutes(window.startTime);
          const end = toMinutes(window.endTime);

          while (minute + query.durationMinutes <= end) {
            const startsAt = localToUtc(cursor, minute, zone);
            const endsAt = new Date(startsAt.getTime() + query.durationMinutes * 60_000);

            const inBlocked = blockedWindows.some((b) =>
              overlaps(
                { startsAt, endsAt },
                {
                  startsAt: localToUtc(cursor, toMinutes(b.startTime!), zone),
                  endsAt: localToUtc(cursor, toMinutes(b.endTime!), zone),
                }
              )
            );

            if (!inBlocked && startsAt > now && startsAt >= query.from && startsAt <= query.to) {
              slots.push({ startsAt, endsAt });
            }
            minute += query.durationMinutes;
          }
        }
      }

      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    if (slots.length === 0) return [];

    const rangeStart = slots[0]!.startsAt;
    const rangeEnd = slots[slots.length - 1]!.endsAt;

    // Anything already taken: confirmed appointments, and live holds from any
    // channel. A pending-payment booking holds nothing — that is the point of
    // taking payment first.
    const [booked, holds] = await Promise.all([
      prisma.booking.findMany({
        where: {
          doctorId: query.doctorId,
          status: { in: ['CONFIRMED', 'COMPLETED', 'NO_SHOW'] },
          startsAt: { gte: rangeStart, lte: rangeEnd },
        },
        select: { startsAt: true, endsAt: true },
      }),
      prisma.slotHold.findMany({
        where: {
          doctorId: query.doctorId,
          releasedAt: null,
          expiresAt: { gt: new Date() },
          startsAt: { gte: rangeStart, lte: rangeEnd },
        },
        select: { startsAt: true, endsAt: true },
      }),
    ]);

    const taken = [...booked, ...holds];
    return slots.filter((slot) => !taken.some((t) => overlaps(slot, t)));
  }

  async hold(request: HoldRequest): Promise<HeldSlot | null> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + request.holdMinutes * 60_000);
    const holdToken = randomBytes(24).toString('hex');

    // Clear an expired hold on this exact slot so the unique constraint below
    // reflects live contention rather than an abandoned attempt.
    await prisma.slotHold.deleteMany({
      where: {
        doctorId: request.doctorId,
        startsAt: request.startsAt,
        OR: [{ expiresAt: { lte: now } }, { releasedAt: { not: null } }],
      },
    });

    const alreadyBooked = await prisma.booking.count({
      where: {
        doctorId: request.doctorId,
        status: { in: ['CONFIRMED', 'COMPLETED', 'NO_SHOW'] },
        startsAt: { lt: request.endsAt },
        endsAt: { gt: request.startsAt },
      },
    });
    if (alreadyBooked > 0) return null;

    try {
      // The unique index on (doctorId, startsAt) is the lock. Two simultaneous
      // attempts from different channels both reach here; the database lets
      // exactly one through and the other lands in the catch.
      const hold = await prisma.slotHold.create({
        data: {
          doctorId: request.doctorId,
          startsAt: request.startsAt,
          endsAt: request.endsAt,
          channel: request.channel,
          partnerId: request.partnerId ?? null,
          holdToken,
          expiresAt,
        },
      });

      await cacheDelete(`availability:${request.doctorId}:*`);
      return {
        holdToken: hold.holdToken,
        expiresAt: hold.expiresAt,
        startsAt: hold.startsAt,
        endsAt: hold.endsAt,
      };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        logger.info({ doctorId: request.doctorId, startsAt: request.startsAt }, 'Slot contended');
        return null;
      }
      throw error;
    }
  }

  async confirm(request: ConfirmRequest): Promise<ConfirmedBooking> {
    const hold = await prisma.slotHold.findUnique({ where: { holdToken: request.holdToken } });
    if (!hold || hold.releasedAt || hold.expiresAt < new Date()) {
      throw new Error('That time is no longer held. Please choose another.');
    }

    await prisma.slotHold.update({
      where: { id: hold.id },
      data: { bookingId: request.bookingId },
    });

    await cacheDelete(`availability:${hold.doctorId}:*`);

    return {
      externalBookingId: `int_${request.bookingId}`,
      joiningUrl: null,
    };
  }

  async release(holdToken: string): Promise<void> {
    const hold = await prisma.slotHold.findUnique({ where: { holdToken } });
    if (!hold) return;
    await prisma.slotHold.delete({ where: { id: hold.id } });
    await cacheDelete(`availability:${hold.doctorId}:*`);
  }

  async cancel(externalBookingId: string): Promise<void> {
    const bookingId = externalBookingId.replace(/^int_/, '');
    await prisma.slotHold.deleteMany({ where: { bookingId } });
    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
    if (booking) await cacheDelete(`availability:${booking.doctorId}:*`);
  }

  async reschedule(externalBookingId: string, slot: TimeSlot): Promise<ConfirmedBooking> {
    const bookingId = externalBookingId.replace(/^int_/, '');
    await prisma.booking.update({
      where: { id: bookingId },
      data: { startsAt: slot.startsAt, endsAt: slot.endsAt },
    });
    await prisma.slotHold.deleteMany({ where: { bookingId } });
    return { externalBookingId, joiningUrl: null };
  }
}
