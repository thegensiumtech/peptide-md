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
        credentials: {
          where: { revokedAt: null },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });
    if (!partner) throw notFound('Partner not found.');

    const appointmentCount = await prisma.booking.count({
      where: billableWhere(partnerId, period),
    });

    const credential = partner.credentials[0] ?? null;

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
