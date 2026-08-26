/**
 * Raising the month's invoices without anyone remembering to.
 *
 * The obvious implementation is a monthly timer. It is also wrong: a timer
 * lives in one process, and a deploy, a crash or a restart on the 31st silently
 * skips a month. Nobody notices until a partner asks why they were not billed.
 *
 * So this asks a question instead of counting down. Every hour: has the month
 * that just finished been invoiced yet? If not, do it. That is correct after a
 * restart, correct if the server was down on the 1st, and correct if two
 * instances run it at once, because generation is idempotent on the unique
 * constraint rather than on this being the only caller.
 *
 * The automation stops at a draft. Delivery is a human pressing send, so a
 * wrong rate or a miscounted appointment cannot reach a partner unseen.
 */
import { prisma } from '@peptide/database';
import { logger } from '../../logger';
import { cacheGet, cacheSet } from '../../lib/redis';
import { generateForPeriod, previousPeriod } from './service';

const CHECK_INTERVAL_MS = 60 * 60 * 1000;

/**
 * Stops two instances doing the same work in the same hour.
 *
 * Not a correctness guarantee, and it does not need to be: generation is safe
 * to run twice. This only keeps the logs honest and saves the queries.
 */
async function claim(period: string): Promise<boolean> {
  const key = `invoicing:generated:${period}`;
  if (await cacheGet(key)) return false;
  await cacheSet(key, new Date().toISOString(), 6 * 60 * 60);
  return true;
}

export async function runMonthlyInvoicing(now: Date = new Date()): Promise<void> {
  const period = previousPeriod(now);

  // Cheapest possible check first: if the month already has invoices, there is
  // nothing to do and this costs one indexed query an hour.
  const already = await prisma.invoice.count({ where: { period } });
  if (already > 0) return;

  // A partner with no appointments gets no invoice, so "no invoices exist"
  // does not by itself mean the month was missed. Confirm there is something
  // to bill before announcing anything.
  const billable = await prisma.booking.count({
    where: {
      channel: 'PARTNER',
      isSandbox: false,
      status: { not: 'CANCELLED' },
      startsAt: {
        gte: new Date(`${period}-01T00:00:00.000Z`),
        lt: new Date(Date.UTC(Number(period.slice(0, 4)), Number(period.slice(5, 7)), 1)),
      },
    },
  });
  if (billable === 0) return;

  if (!(await claim(period))) return;

  logger.info({ period, billable }, 'Raising invoices for the month just finished');
  const result = await generateForPeriod(period);
  logger.info(
    { period, created: result.created, skipped: result.skipped },
    'Monthly invoicing complete, drafts are waiting to be reviewed and sent'
  );
}

export function startMonthlyInvoicing(): NodeJS.Timeout {
  // Once at boot as well as hourly. A server that was down over the 1st should
  // catch up when it comes back, not wait for the top of the next hour.
  runMonthlyInvoicing().catch((error) =>
    logger.error({ err: error }, 'Monthly invoicing failed at boot')
  );

  return setInterval(() => {
    runMonthlyInvoicing().catch((error) =>
      logger.error({ err: error }, 'Monthly invoicing failed')
    );
  }, CHECK_INTERVAL_MS);
}
