/**
 * What a partner owes for, defined once.
 *
 * Two places need this answer: the running total the partner sees in their
 * portal, and the invoice we raise at the end of the month. If those two ever
 * disagree, the partner is told one number and billed another, which is the
 * kind of thing that ends a commercial relationship. So they share this file
 * for the same reason the diary and the public calendar share buildSlotGrid.
 *
 * The portal's own version of this had no upper bound on the date, so a
 * booking three months out was counted into *this* month's running total. A
 * partner was being shown money they did not owe yet.
 */
import type { Prisma } from '@peptide/database';

/** 'YYYY-MM' for the month a date falls in, in UTC. */
export function periodOf(date: Date): string {
  return date.toISOString().slice(0, 7);
}

export function currentPeriod(): string {
  return periodOf(new Date());
}

/** The half-open interval [start, end) covering one billing period. */
export function periodBounds(period: string): { start: Date; end: Date } {
  const start = new Date(`${period}-01T00:00:00.000Z`);
  if (Number.isNaN(start.getTime())) {
    throw new Error(`Not a billing period: ${period}. Expected YYYY-MM.`);
  }

  // Half-open on purpose. Asking for "the last instant of the month" invites
  // an off-by-one at midnight; asking for "before the first of next month"
  // cannot be wrong.
  const end = new Date(
    Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1, 0, 0, 0, 0)
  );

  return { start, end };
}

/**
 * A booking counts towards a partner's invoice when it happened in the period,
 * belongs to them, and was not cancelled.
 *
 * Sandbox bookings are excluded. A partner testing their integration is not
 * buying appointments, and billing them for it would be indefensible.
 *
 * Note this counts appointments by when they are *scheduled*, not when they
 * were booked. A consultation booked in August for September is September's
 * business, which is what the partner expects to be invoiced for.
 */
export function billableWhere(partnerId: string, period: string): Prisma.BookingWhereInput {
  const { start, end } = periodBounds(period);
  return {
    partnerId,
    isSandbox: false,
    status: { not: 'CANCELLED' },
    startsAt: { gte: start, lt: end },
  };
}
