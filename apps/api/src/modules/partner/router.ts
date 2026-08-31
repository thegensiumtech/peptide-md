import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '@peptide/database';
import { billableWhere, currentPeriod } from '../invoicing/billing';
import { handle, notFound, ok } from '../../http/errors';
import { partnerIdOf, requireAuth, requirePartner } from '../../http/middleware/auth';

export const partnerRouter = Router();

/**
 * The partner portal.
 *
 * Every handler reads the partner id from the verified token via
 * `partnerIdOf`, never from a parameter or the body. That is the tenant
 * boundary the scope requires to be enforced in the API rather than left to
 * the front end, there is no route here that can be pointed at another
 * partner's data.
 */
partnerRouter.use(requireAuth, requirePartner);

// Shared with the invoicing service on purpose: the running total shown here
// and the invoice raised at month end must be the same question, or a partner
// is told one number and billed another.


partnerRouter.get(
  '/me',
  handle(async (req, res) => {
    const partnerId = partnerIdOf(req);
    const period = currentPeriod();

    const partner = await prisma.partner.findUnique({
      where: { id: partnerId },
      include: {
        // Every live credential, newest first. Deliberately not `take: 1` on
        // the whole set: a partner has a live pair and a sandbox pair, the
        // sandbox one is issued second and so is newer, and taking the newest
        // handed every partner their sandbox client id labelled as their
        // credential. Integrating against that books the sandbox doctor, which
        // looks like it works and never creates a real appointment.
        credentials: {
          where: { revokedAt: null },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!partner) throw notFound('Partner not found.');

    const appointmentCount = await prisma.booking.count({
      where: billableWhere(partnerId, period),
    });

    const credential = partner.credentials.find((c) => !c.isSandbox) ?? null;
    const sandboxCredential = partner.credentials.find((c) => c.isSandbox) ?? null;

    return ok(res, {
      id: partner.id,
      name: partner.name,
      slug: partner.slug,
      status: partner.status.toLowerCase(),
      integration: partner.integration.toLowerCase(),
      ratePerAppointment: partner.ratePerAppointment,
      currency: partner.currency,
      contactName: partner.contactName,
      contactEmail: partner.contactEmail,
      billingEmail: partner.billingEmail,
      rateLimitPerMinute: partner.rateLimitPerMinute,
      branding: {
        primaryColor: partner.brandPrimaryColor,
        accentColor: partner.brandAccentColor,
        fontFamily: partner.brandFontFamily,
        logoUrl: partner.brandLogoUrl,
        displayName: partner.brandDisplayName,
      },
      credentials: credential
        ? {
            clientId: credential.clientId,
            // Never the secret itself, it is shown once, at issue.
            secretLastFour: credential.secretLastFour,
            createdAt: credential.createdAt.toISOString(),
            lastRotatedAt: credential.expiresAt?.toISOString() ?? null,
            lastUsedAt: credential.lastUsedAt?.toISOString() ?? null,
          }
        : null,
      // The sandbox pair, so a partner can build against a diary that is not
      // the doctor's. The scope asks for these to be handed over as part of
      // the API documentation.
      sandboxCredentials: sandboxCredential
        ? {
            clientId: sandboxCredential.clientId,
            secretLastFour: sandboxCredential.secretLastFour,
            createdAt: sandboxCredential.createdAt.toISOString(),
            lastUsedAt: sandboxCredential.lastUsedAt?.toISOString() ?? null,
          }
        : null,
      volume: {
        period,
        appointmentCount,
        ratePerAppointment: partner.ratePerAppointment,
        runningTotal: appointmentCount * partner.ratePerAppointment,
        currency: partner.currency,
      },
    });
  })
);

const listQuery = z.object({
  limit: z.coerce.number().min(1).max(200).default(100),
});

partnerRouter.get(
  '/bookings',
  handle(async (req, res) => {
    const partnerId = partnerIdOf(req);
    const { limit } = listQuery.parse(req.query);

    const bookings = await prisma.booking.findMany({
      where: { partnerId },
      include: { patient: true },
      orderBy: { startsAt: 'desc' },
      take: limit,
    });

    // A partner sees that an appointment happened and its state. What the
    // patient told the doctor is clinical and is never returned here.
    return ok(
      res,
      bookings.map((booking) => ({
        id: booking.id,
        reference: booking.reference,
        status: booking.status.toLowerCase(),
        startsAt: booking.startsAt.toISOString(),
        endsAt: booking.endsAt.toISOString(),
        patientName: booking.patient.name,
        patientTimezone: booking.patientTimezone,
        createdAt: booking.createdAt.toISOString(),
      }))
    );
  })
);

partnerRouter.get(
  '/invoices',
  handle(async (req, res) => {
    const partnerId = partnerIdOf(req);

    const invoices = await prisma.invoice.findMany({
      where: { partnerId },
      orderBy: [{ period: 'desc' }],
    });

    return ok(
      res,
      invoices.map((invoice) => ({
        id: invoice.id,
        number: invoice.number,
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
      }))
    );
  })
);

/**
 * Rotate the API secret.
 *
 * The new secret is returned exactly once. The old one keeps working for 24
 * hours so a partner can deploy the change without downtime.
 */
partnerRouter.post(
  '/credentials/rotate',
  handle(async (req, res) => {
    const partnerId = partnerIdOf(req);
    const { randomBytes } = await import('node:crypto');
    const bcrypt = (await import('bcryptjs')).default;

    const partner = await prisma.partner.findUnique({ where: { id: partnerId } });
    if (!partner) throw notFound('Partner not found.');

    const secret = `pmd_sk_live_${randomBytes(24).toString('hex')}`;

    await prisma.partnerCredential.updateMany({
      where: { partnerId, revokedAt: null },
      data: { expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) },
    });

    const credential = await prisma.partnerCredential.create({
      data: {
        partnerId,
        clientId: `pmd_live_${partner.slug.replace(/-/g, '').slice(0, 6)}_${randomBytes(4).toString('hex')}`,
        secretHash: await bcrypt.hash(secret, 10),
        secretLastFour: secret.slice(-4),
      },
    });

    return ok(res, {
      clientId: credential.clientId,
      secret,
      warning: 'Copy this now. It cannot be shown again. The previous secret stops working in 24 hours.',
    });
  })
);

/**
 * GET /api/partner/invoices/:id/pdf
 *
 * The partner's own copy. Scoped to the token's partner before anything is
 * rendered, so an invoice id belonging to someone else is a 404 rather than a
 * download. Ids are guessable enough that this has to be checked here and not
 * left to the screen that links to it.
 */
partnerRouter.get(
  '/invoices/:id/pdf',
  handle(async (req, res) => {
    const partnerId = partnerIdOf(req);
    const invoice = await prisma.invoice.findUnique({
      where: { id: String(req.params.id) },
      select: { id: true, partnerId: true, status: true },
    });

    if (!invoice || invoice.partnerId !== partnerId) {
      throw notFound('That invoice could not be found.');
    }
    // A draft has not been raised yet. Letting a partner download one would be
    // showing them a figure we have not committed to.
    if (invoice.status === 'DRAFT') {
      throw notFound('That invoice has not been issued yet.');
    }

    const { renderInvoicePdf } = await import('../invoicing/pdf');
    const document = await renderInvoicePdf(invoice.id);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${document.filename}"`);
    res.send(document.pdf);
    return undefined;
  })
);
