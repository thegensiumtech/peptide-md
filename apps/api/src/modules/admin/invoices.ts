/**
 * Invoicing, from the admin's side.
 *
 * The shape of this is set by one decision: an invoice is raised as a draft and
 * a person presses send. Generation is automatic, delivery is not. So the
 * endpoints below are mostly about giving an admin enough to check the figures
 * before they commit to them, and refusing to let them commit twice.
 *
 * Money moves in one direction here and there is no undo, so every transition
 * is explicit: generate, refresh, send, mark paid, void. Nothing happens as a
 * side effect of something else.
 */
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '@peptide/database';
import { badRequest, conflict, handle, notFound, ok } from '../../http/errors';
import { requireRole } from '../../http/middleware/auth';
import { sendEmail } from '../../email';
import { partnerInvoice } from '../../email/templates';
import { generateForPeriod, previousPeriod, refreshInvoice } from '../invoicing/service';
import { renderInvoicePdf } from '../invoicing/pdf';
import { currentPeriod } from '../invoicing/billing';
import { logger } from '../../logger';

export const adminInvoicesRouter = Router();

adminInvoicesRouter.use(requireRole('ADMIN'));

const serialise = (invoice: {
  id: string;
  number: string;
  partnerId: string;
  period: string;
  appointmentCount: number;
  ratePerAppointment: number;
  totalAmount: number;
  currency: string;
  status: string;
  pdfUrl: string | null;
  issuedAt: Date | null;
  dueAt: Date | null;
  paidAt: Date | null;
  sentAt: Date | null;
  partner?: { name: string } | null;
  lines?: Array<{ bookingId: string }>;
}) => ({
  id: invoice.id,
  number: invoice.number,
  partnerId: invoice.partnerId,
  partnerName: invoice.partner?.name ?? '',
  period: invoice.period,
  appointmentCount: invoice.appointmentCount,
  ratePerAppointment: invoice.ratePerAppointment,
  totalAmount: invoice.totalAmount,
  currency: invoice.currency,
  status: invoice.status.toLowerCase(),
  pdfUrl: invoice.pdfUrl,
  issuedAt: invoice.issuedAt?.toISOString() ?? null,
  dueAt: invoice.dueAt?.toISOString() ?? null,
  paidAt: invoice.paidAt?.toISOString() ?? null,
  sentAt: invoice.sentAt?.toISOString() ?? null,
  bookingIds: invoice.lines?.map((line) => line.bookingId) ?? [],
});

const listQuery = z.object({
  partnerId: z.string().optional(),
  status: z.enum(['draft', 'sent', 'paid', 'overdue', 'void']).optional(),
  period: z.string().regex(/^\d{4}-\d{2}$/).optional(),
});

/** GET /api/admin/invoices */
adminInvoicesRouter.get(
  '/',
  handle(async (req, res) => {
    const filters = listQuery.parse(req.query);

    const invoices = await prisma.invoice.findMany({
      where: {
        ...(filters.partnerId ? { partnerId: filters.partnerId } : {}),
        ...(filters.status ? { status: filters.status.toUpperCase() as never } : {}),
        ...(filters.period ? { period: filters.period } : {}),
      },
      include: { partner: { select: { name: true } }, lines: { select: { bookingId: true } } },
      orderBy: [{ period: 'desc' }, { number: 'asc' }],
    });

    const outstanding = invoices
      .filter((invoice) => invoice.status === 'SENT' || invoice.status === 'OVERDUE')
      .reduce((total, invoice) => total + invoice.totalAmount, 0);

    return ok(res, {
      currentPeriod: currentPeriod(),
      outstanding,
      invoices: invoices.map(serialise),
    });
  })
);

/** GET /api/admin/invoices/:id, with the appointments behind the total. */
adminInvoicesRouter.get(
  '/:id',
  handle(async (req, res) => {
    const invoice = await prisma.invoice.findUnique({
      where: { id: String(req.params.id) },
      include: {
        partner: true,
        lines: {
          include: { booking: { include: { patient: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!invoice) throw notFound('That invoice could not be found.');

    return ok(res, {
      invoice: serialise(invoice),
      // The evidence for the total. An admin approving an invoice should be
      // able to see what they are approving without leaving the screen.
      appointments: invoice.lines.map((line) => ({
        id: line.booking.id,
        reference: line.booking.reference,
        startsAt: line.booking.startsAt.toISOString(),
        status: line.booking.status.toLowerCase(),
        patientName: line.booking.patient.name,
        amount: line.amount,
      })),
    });
  })
);

const generateSchema = z.object({
  period: z.string().regex(/^\d{4}-\d{2}$/, 'Use a period of the form 2026-08.').optional(),
});

/**
 * POST /api/admin/invoices/generate
 *
 * Raises drafts for a period. Safe to run repeatedly: an existing draft is
 * brought back in line with reality rather than duplicated, and anything
 * already sent is left alone.
 */
adminInvoicesRouter.post(
  '/generate',
  handle(async (req, res) => {
    const { period } = generateSchema.parse(req.body ?? {});
    const result = await generateForPeriod(period ?? previousPeriod());
    return ok(res, result);
  })
);

/** POST /api/admin/invoices/:id/refresh, recount a draft before sending. */
adminInvoicesRouter.post(
  '/:id/refresh',
  handle(async (req, res) => {
    await refreshInvoice(String(req.params.id));
    const invoice = await prisma.invoice.findUnique({
      where: { id: String(req.params.id) },
      include: { partner: { select: { name: true } }, lines: { select: { bookingId: true } } },
    });
    if (!invoice) throw notFound('That invoice could not be found.');
    return ok(res, { invoice: serialise(invoice) });
  })
);

const dueDays = 14;

/**
 * POST /api/admin/invoices/:id/send
 *
 * The one irreversible step. Renders the PDF, emails it to the partner's
 * billing address, and moves the invoice to SENT.
 *
 * The status only moves if the email actually went out. Marking an invoice
 * sent when it bounced would leave a partner never billed and an admin certain
 * they had been.
 */
adminInvoicesRouter.post(
  '/:id/send',
  handle(async (req, res) => {
    const invoice = await prisma.invoice.findUnique({
      where: { id: String(req.params.id) },
      include: { partner: true },
    });
    if (!invoice) throw notFound('That invoice could not be found.');

    if (invoice.status === 'VOID') {
      throw conflict('That invoice was voided.', 'INVOICE_VOID');
    }
    if (invoice.appointmentCount === 0) {
      throw badRequest('That invoice has no appointments on it.', 'INVOICE_EMPTY');
    }

    const issuedAt = invoice.issuedAt ?? new Date();
    const dueAt = invoice.dueAt ?? new Date(issuedAt.getTime() + dueDays * 24 * 60 * 60 * 1000);

    const document = await renderInvoicePdf(invoice.id);

    const sent = await sendEmail('PARTNER_INVOICE', {
      ...partnerInvoice({
        number: invoice.number,
        partnerName: invoice.partner.name,
        billingEmail: invoice.partner.billingEmail,
        period: invoice.period,
        appointmentCount: invoice.appointmentCount,
        ratePerAppointment: invoice.ratePerAppointment,
        totalAmount: invoice.totalAmount,
        currency: invoice.currency,
        dueAt,
      }),
      pdfContent: document.pdf,
      pdfFilename: document.filename,
    });

    if (!sent) {
      throw badRequest(
        'The invoice could not be emailed, so it has not been marked as sent. Check the email log and try again.',
        'INVOICE_EMAIL_FAILED'
      );
    }

    const updated = await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        status: 'SENT',
        issuedAt,
        dueAt,
        sentAt: new Date(),
        // An API path, not a public URL. The PDF is regenerated on request and
        // served through an authenticated, tenant-scoped route.
        pdfUrl: `/api/admin/invoices/${invoice.id}/pdf`,
      },
      include: { partner: { select: { name: true } }, lines: { select: { bookingId: true } } },
    });

    logger.info({ invoice: invoice.number, to: invoice.partner.billingEmail }, 'Invoice sent');
    return ok(res, { invoice: serialise(updated) });
  })
);

/** POST /api/admin/invoices/:id/paid */
adminInvoicesRouter.post(
  '/:id/paid',
  handle(async (req, res) => {
    const invoice = await prisma.invoice.findUnique({ where: { id: String(req.params.id) } });
    if (!invoice) throw notFound('That invoice could not be found.');
    if (invoice.status === 'DRAFT') {
      throw conflict('That invoice has not been sent yet.', 'INVOICE_NOT_SENT');
    }
    if (invoice.status === 'PAID') {
      return ok(res, { alreadyPaid: true });
    }

    const updated = await prisma.invoice.update({
      where: { id: invoice.id },
      data: { status: 'PAID', paidAt: new Date() },
      include: { partner: { select: { name: true } }, lines: { select: { bookingId: true } } },
    });

    return ok(res, { invoice: serialise(updated) });
  })
);

const voidSchema = z.object({ reason: z.string().max(500).optional() });

/**
 * POST /api/admin/invoices/:id/void
 *
 * Voided rather than deleted. An invoice number that simply disappears leaves
 * a gap in the sequence, and a gap is indistinguishable from a missing record
 * when someone audits it later.
 */
adminInvoicesRouter.post(
  '/:id/void',
  handle(async (req, res) => {
    const { reason } = voidSchema.parse(req.body ?? {});
    const invoice = await prisma.invoice.findUnique({ where: { id: String(req.params.id) } });
    if (!invoice) throw notFound('That invoice could not be found.');
    if (invoice.status === 'PAID') {
      throw conflict('That invoice has been paid. Raise a credit note instead.', 'INVOICE_PAID');
    }

    const updated = await prisma.invoice.update({
      where: { id: invoice.id },
      data: { status: 'VOID' },
      include: { partner: { select: { name: true } }, lines: { select: { bookingId: true } } },
    });

    logger.info({ invoice: invoice.number, reason }, 'Invoice voided');
    return ok(res, { invoice: serialise(updated) });
  })
);

/**
 * GET /api/admin/invoices/:id/pdf
 *
 * Generated on request rather than stored. The figures come from the database
 * either way, so a stored file could only ever be a stale copy of them.
 */
adminInvoicesRouter.get(
  '/:id/pdf',
  handle(async (req, res) => {
    const document = await renderInvoicePdf(String(req.params.id));
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${document.filename}"`);
    res.send(document.pdf);
    return undefined;
  })
);
