import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '@peptide/database';
import { handle, ok } from '../../http/errors';
import { requireRole } from '../../http/middleware/auth';

/**
 * Admin reporting: volume by source, by partner and by period.
 *
 * The dashboard already answers "how are we doing this month". This answers
 * "how have we been doing", which is a different question and needs a window
 * rather than a single period.
 *
 * Two decisions worth stating, because both are easy to get subtly wrong and
 * neither is visible in the output:
 *
 *  - **Periods are filled, not just those with data.** A month where nobody
 *    booked has to appear as a zero. Reporting only the months that exist in
 *    the table silently closes the gap and turns a quiet August into a bar
 *    sitting next to July as though they were consecutive.
 *
 *  - **Money comes from the invoice where there is one.** A partner's rate can
 *    change, and the scope is explicit that changing it never restates an
 *    invoice already raised. So a settled period is priced at the rate its
 *    invoice captured, and only an unbilled period falls back to the rate on
 *    the partner record. Reading the current rate for every period would
 *    quietly rewrite history every time somebody edits a partner.
 */
export const adminReportsRouter = Router();

// Commercial figures. The doctor role never sees revenue, and the whole of
// this module is revenue, so the guard sits on the router rather than on each
// route.
adminReportsRouter.use(requireRole('ADMIN'));

const PERIOD = /^\d{4}-\d{2}$/;

const reportQuery = z.object({
  from: z.string().regex(PERIOD, 'Use YYYY-MM.').optional(),
  to: z.string().regex(PERIOD, 'Use YYYY-MM.').optional(),
});

/** `2026-08` plus one month, staying in UTC so a DST boundary cannot shift it. */
function nextPeriod(period: string): string {
  const [year, month] = period.split('-').map(Number) as [number, number];
  return month === 12
    ? `${year + 1}-01`
    : `${year}-${String(month + 1).padStart(2, '0')}`;
}

/** Every period from `from` to `to` inclusive, oldest first. */
function periodsBetween(from: string, to: string): string[] {
  const out: string[] = [];
  let cursor = from;
  // Bounded so a reversed or absurd range cannot spin. Ten years of months is
  // far past anything the screen would draw.
  while (cursor <= to && out.length < 120) {
    out.push(cursor);
    cursor = nextPeriod(cursor);
  }
  return out;
}

const periodStart = (period: string) => new Date(`${period}-01T00:00:00.000Z`);

adminReportsRouter.get(
  '/',
  handle(async (req, res) => {
    const { from: rawFrom, to: rawTo } = reportQuery.parse(req.query);

    const thisPeriod = new Date().toISOString().slice(0, 7);
    const to = rawTo ?? thisPeriod;

    // Six months back by default, matching what the dashboard chart claims to
    // show. Computed by walking back rather than subtracting from the month
    // number, so it crosses a year boundary correctly.
    const defaultFrom = (() => {
      let cursor = to;
      for (let i = 0; i < 5; i += 1) {
        const [year, month] = cursor.split('-').map(Number) as [number, number];
        cursor = month === 1 ? `${year - 1}-12` : `${year}-${String(month - 1).padStart(2, '0')}`;
      }
      return cursor;
    })();

    const from = rawFrom && rawFrom <= to ? rawFrom : defaultFrom;

    const periods = periodsBetween(from, to);
    const windowStart = periodStart(from);
    const windowEnd = periodStart(nextPeriod(to));

    const [bookings, partners, invoices] = await Promise.all([
      prisma.booking.findMany({
        where: {
          // Bucketed on when the appointment happens, not when it was booked.
          // An invoice counts the appointments in its month, so the report has
          // to agree with the invoice or the two never reconcile.
          startsAt: { gte: windowStart, lt: windowEnd },
          status: { not: 'CANCELLED' },
          // A partner testing their integration must never move these numbers.
          isSandbox: false,
        },
        select: {
          channel: true,
          partnerId: true,
          startsAt: true,
          amountPaid: true,
          paymentStatus: true,
        },
      }),
      prisma.partner.findMany({ select: { id: true, name: true, ratePerAppointment: true } }),
      prisma.invoice.findMany({
        where: { period: { in: periods }, status: { not: 'VOID' } },
        select: { partnerId: true, period: true, ratePerAppointment: true },
      }),
    ]);

    const partnerById = new Map(partners.map((p) => [p.id, p]));
    // The rate actually charged for a partner in a period, where an invoice
    // has already fixed it.
    const invoicedRate = new Map(invoices.map((i) => [`${i.partnerId}:${i.period}`, i.ratePerAppointment]));

    const periodOf = (date: Date) => date.toISOString().slice(0, 7);

    const bySource = periods.map((period) => {
      const inPeriod = bookings.filter((b) => periodOf(b.startsAt) === period);
      const direct = inPeriod.filter((b) => b.channel === 'DIRECT').length;
      const partner = inPeriod.filter((b) => b.channel === 'PARTNER').length;
      return { period, direct, partner, total: direct + partner };
    });

    // Keyed on partner and period, so a partner appears once per month and
    // only for months they actually sent something.
    //
    // Keyed on partnerId alone, deliberately, because that is exactly what
    // billableWhere in the invoicing module counts. Adding `channel ===
    // 'PARTNER'` here would look equivalent and is today, but the moment the
    // two rules disagree the report stops reconciling with the invoice, and a
    // report that quietly differs from the bill is worse than none.
    const partnerCounts = new Map<string, number>();
    for (const booking of bookings) {
      if (!booking.partnerId) continue;
      const key = `${booking.partnerId}:${periodOf(booking.startsAt)}`;
      partnerCounts.set(key, (partnerCounts.get(key) ?? 0) + 1);
    }

    const byPartner = [...partnerCounts.entries()]
      .map(([key, appointmentCount]) => {
        const [partnerId, period] = key.split(':') as [string, string];
        const partner = partnerById.get(partnerId);
        const rate = invoicedRate.get(key) ?? partner?.ratePerAppointment ?? null;

        return {
          partnerId,
          // A deleted partner still has history. Naming it rather than
          // dropping the row keeps the totals adding up.
          partnerName: partner?.name ?? 'Removed partner',
          period,
          appointmentCount,
          billableAmount: rate === null ? null : rate * appointmentCount,
        };
      })
      .sort((a, b) => (a.period === b.period ? a.partnerName.localeCompare(b.partnerName) : a.period.localeCompare(b.period)));

    const totals = {
      direct: bySource.reduce((sum, p) => sum + p.direct, 0),
      partner: bySource.reduce((sum, p) => sum + p.partner, 0),
      total: bySource.reduce((sum, p) => sum + p.total, 0),
      billableAmount: byPartner.reduce((sum, row) => sum + (row.billableAmount ?? 0), 0),
      directRevenue: bookings
        .filter((b) => b.channel === 'DIRECT' && b.paymentStatus === 'PAID')
        .reduce((sum, b) => sum + (b.amountPaid ?? 0), 0),
    };

    return ok(res, { from, to, bySource, byPartner, totals, currency: 'GBP' });
  })
);
