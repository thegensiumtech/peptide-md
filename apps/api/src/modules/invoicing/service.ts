/**
 * Monthly invoicing.
 *
 * At the end of each month every partner is billed for the appointments they
 * sent, at the rate agreed with them. The whole commercial model rests on this
 * being right, so three properties matter more than the code:
 *
 *  - **Idempotent.** Generation can run twice, or be re-run by hand after a
 *    failure, without double billing. Guaranteed by two unique constraints
 *    already in the schema rather than by remembering to check.
 *  - **A booking is billed once.** `@@unique([invoiceId, bookingId])` makes a
 *    duplicate line impossible even if the query above it were wrong.
 *  - **History does not move.** The rate is copied onto the invoice and onto
 *    every line at generation. Changing a partner's rate next month never
 *    restates an invoice already raised, which is what makes an old invoice
 *    worth anything as a record.
 *
 * Invoices are raised as DRAFT and sent by a human. Nothing reaches a partner
 * without an admin having seen it.
 */
import { prisma } from '@peptide/database';
import type { Invoice } from '@peptide/database';
import { logger } from '../../logger';
import { billableWhere, periodBounds, periodOf } from './billing';

/**
 * INV-2026-08-NEWYOU.
 *
 * Deterministic, so re-running generation produces the same number rather than
 * a second one, and readable enough that a partner quoting it on an email is
 * unambiguous. The unique index on `number` is the real guard.
 */
export function invoiceNumber(period: string, slug: string): string {
  const token = slug.replace(/[^a-z0-9]/gi, '').toUpperCase().slice(0, 8) || 'PARTNER';
  return `INV-${period.replace('-', '-')}-${token}`;
}

/** The month just finished, which is what a run on the 1st should bill for. */
export function previousPeriod(now: Date = new Date()): string {
  return periodOf(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)));
}

export interface GenerationResult {
  period: string;
  created: number;
  skipped: number;
  invoices: Array<{ id: string; number: string; partnerName: string; appointmentCount: number; totalAmount: number }>;
}

/**
 * Raises a draft invoice for every partner with billable appointments in the
 * period.
 *
 * A partner with nothing to bill gets no invoice at all, rather than a zero.
 * An invoice for nothing is noise, and it would still need a human to void it.
 */
export async function generateForPeriod(period: string): Promise<GenerationResult> {
  periodBounds(period); // Validates the format before anything is written.

  const partners = await prisma.partner.findMany({ orderBy: { name: 'asc' } });
  const result: GenerationResult = { period, created: 0, skipped: 0, invoices: [] };

  for (const partner of partners) {
    const bookings = await prisma.booking.findMany({
      where: billableWhere(partner.id, period),
      select: { id: true },
      orderBy: { startsAt: 'asc' },
    });

    if (bookings.length === 0) {
      result.skipped += 1;
      continue;
    }

    const existing = await prisma.invoice.findUnique({
      where: { partnerId_period: { partnerId: partner.id, period } },
      include: { lines: true },
    });

    // Already raised. A draft is refreshed because late bookings and
    // cancellations are still landing; anything sent is left alone, because
    // restating an invoice a partner already has is how disputes start.
    if (existing) {
      if (existing.status !== 'DRAFT') {
        result.skipped += 1;
        continue;
      }
      await refreshDraft(existing, partner.id, partner.ratePerAppointment, period);
      result.skipped += 1;
      continue;
    }

    const invoice = await prisma.invoice.create({
      data: {
        number: invoiceNumber(period, partner.slug),
        partnerId: partner.id,
        period,
        appointmentCount: bookings.length,
        ratePerAppointment: partner.ratePerAppointment,
        totalAmount: bookings.length * partner.ratePerAppointment,
        currency: partner.currency,
        status: 'DRAFT',
        lines: {
          create: bookings.map((booking) => ({
            bookingId: booking.id,
            amount: partner.ratePerAppointment,
          })),
        },
      },
    });

    result.created += 1;
    result.invoices.push({
      id: invoice.id,
      number: invoice.number,
      partnerName: partner.name,
      appointmentCount: invoice.appointmentCount,
      totalAmount: invoice.totalAmount,
    });
  }

  logger.info(result, 'Invoice generation finished');
  return result;
}

/**
 * Brings a draft back in line with reality.
 *
 * Between the 1st and the day someone presses send, an appointment can be
 * cancelled or a late one can land. A draft that still showed the figures from
 * generation time would be quietly wrong, and it is the number a human is
 * about to approve.
 */
async function refreshDraft(
  invoice: Invoice & { lines: Array<{ bookingId: string }> },
  partnerId: string,
  ratePerAppointment: number,
  period: string
): Promise<void> {
  const bookings = await prisma.booking.findMany({
    where: billableWhere(partnerId, period),
    select: { id: true },
  });

  const current = new Set(bookings.map((b) => b.id));
  const onInvoice = new Set(invoice.lines.map((l) => l.bookingId));

  const toAdd = [...current].filter((id) => !onInvoice.has(id));
  const toRemove = [...onInvoice].filter((id) => !current.has(id));

  if (toRemove.length) {
    await prisma.invoiceLine.deleteMany({
      where: { invoiceId: invoice.id, bookingId: { in: toRemove } },
    });
  }

  if (toAdd.length) {
    await prisma.invoiceLine.createMany({
      // The rate on the invoice, not the partner's current rate. A draft raised
      // in August is an August invoice even if the rate changed since.
      data: toAdd.map((bookingId) => ({
        invoiceId: invoice.id,
        bookingId,
        amount: invoice.ratePerAppointment,
      })),
      skipDuplicates: true,
    });
  }

  if (toAdd.length || toRemove.length) {
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        appointmentCount: current.size,
        totalAmount: current.size * invoice.ratePerAppointment,
      },
    });
    logger.info(
      { invoice: invoice.number, added: toAdd.length, removed: toRemove.length },
      'Draft invoice refreshed'
    );
  }

  // ratePerAppointment is deliberately not touched here, even though it is
  // passed in. It is captured once and stays captured.
  void ratePerAppointment;
}

/** Recalculates a single draft on demand, for the admin screen's refresh. */
export async function refreshInvoice(invoiceId: string): Promise<void> {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { lines: true, partner: true },
  });
  if (!invoice || invoice.status !== 'DRAFT') return;
  await refreshDraft(invoice, invoice.partnerId, invoice.ratePerAppointment, invoice.period);
}
