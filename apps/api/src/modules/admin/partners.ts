/**
 * Managing partners.
 *
 * The scope promises that "adding a partner is a data task, not a development
 * task". That is what this file has to make true: create the company, issue
 * their credentials, set their rate, configure their branding, all without a
 * deploy.
 *
 * Everything here is admin only. The doctor has no business seeing commercial
 * rates and the partner router is a different tenant entirely, so this mounts
 * behind `requireRole('ADMIN')` rather than the admin router's default, which
 * also admits the doctor.
 */
import { Router } from 'express';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { prisma } from '@peptide/database';
import { badRequest, conflict, handle, notFound, ok } from '../../http/errors';
import { requireRole } from '../../http/middleware/auth';
import { billableWhere, currentPeriod } from '../invoicing/billing';

export const adminPartnersRouter = Router();

adminPartnersRouter.use(requireRole('ADMIN'));

/** Lowercase, hyphenated, safe in a URL and in a client id. */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

/**
 * A client id is public, a secret is not.
 *
 * The id carries a readable fragment of the slug so an admin looking at two
 * credentials can tell which partner they belong to without a lookup. The
 * secret is 48 hex characters from a CSPRNG and is returned exactly once.
 */
function issueCredentialValues(slug: string, isSandbox: boolean) {
  const token = slug.replace(/-/g, '').slice(0, 6) || 'partner';
  const kind = isSandbox ? 'test' : 'live';
  return {
    clientId: `pmd_${kind}_${token}_${randomBytes(4).toString('hex')}`,
    secret: `pmd_sk_${kind}_${randomBytes(24).toString('hex')}`,
  };
}

const serialisePartner = (
  partner: Awaited<ReturnType<typeof loadPartner>>,
  volume?: { appointmentCount: number; runningTotal: number }
) => ({
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
  branding: {
    primaryColor: partner.brandPrimaryColor,
    accentColor: partner.brandAccentColor,
    fontFamily: partner.brandFontFamily,
    logoUrl: partner.brandLogoUrl,
    displayName: partner.brandDisplayName,
  },
  rateLimitPerMinute: partner.rateLimitPerMinute,
  createdAt: partner.createdAt.toISOString(),
  // Never the hash and never the secret. Only enough to say which is in use.
  credentials: partner.credentials.map((credential) => ({
    id: credential.id,
    clientId: credential.clientId,
    secretLastFour: credential.secretLastFour,
    isSandbox: credential.isSandbox,
    createdAt: credential.createdAt.toISOString(),
    lastUsedAt: credential.lastUsedAt?.toISOString() ?? null,
    expiresAt: credential.expiresAt?.toISOString() ?? null,
    revokedAt: credential.revokedAt?.toISOString() ?? null,
  })),
  ...(volume ? { volume } : {}),
});

async function loadPartner(id: string) {
  const partner = await prisma.partner.findUnique({
    where: { id },
    include: { credentials: { orderBy: { createdAt: 'desc' } } },
  });
  if (!partner) throw notFound('That partner could not be found.');
  return partner;
}

/** GET /api/admin/partners */
adminPartnersRouter.get(
  '/',
  handle(async (_req, res) => {
    const period = currentPeriod();
    const partners = await prisma.partner.findMany({
      include: { credentials: { orderBy: { createdAt: 'desc' } } },
      orderBy: { name: 'asc' },
    });

    // One count per partner rather than one query per partner per screen.
    const counts = await prisma.booking.groupBy({
      by: ['partnerId'],
      where: {
        partnerId: { in: partners.map((p) => p.id) },
        isSandbox: false,
        status: { not: 'CANCELLED' },
        startsAt: {
          gte: new Date(`${period}-01T00:00:00.000Z`),
          lt: new Date(
            Date.UTC(
              Number(period.slice(0, 4)),
              Number(period.slice(5, 7)),
              1
            )
          ),
        },
      },
      _count: { _all: true },
    });

    const countOf = new Map(counts.map((row) => [row.partnerId, row._count._all]));

    return ok(res, {
      period,
      partners: partners.map((partner) => {
        const appointmentCount = countOf.get(partner.id) ?? 0;
        return serialisePartner(partner, {
          appointmentCount,
          runningTotal: appointmentCount * partner.ratePerAppointment,
        });
      }),
    });
  })
);

/** GET /api/admin/partners/:id */
adminPartnersRouter.get(
  '/:id',
  handle(async (req, res) => {
    const partner = await loadPartner(String(req.params.id));
    const period = currentPeriod();
    const appointmentCount = await prisma.booking.count({
      where: billableWhere(partner.id, period),
    });

    return ok(res, {
      period,
      partner: serialisePartner(partner, {
        appointmentCount,
        runningTotal: appointmentCount * partner.ratePerAppointment,
      }),
    });
  })
);

const brandingSchema = z.object({
  primaryColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Use a six digit hex colour, for example #0B3C49.'),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use a six digit hex colour.'),
  fontFamily: z.string().min(1).max(80),
  logoUrl: z.string().url().max(500).nullable().optional(),
  displayName: z.string().min(1, 'The patient sees this name, so it cannot be blank.').max(120),
});

const createPartner = z.object({
  name: z.string().min(1, 'A partner name is required.').max(160),
  slug: z.string().max(48).optional(),
  integration: z.enum(['embed', 'api']).default('embed'),
  status: z.enum(['active', 'suspended']).default('active'),
  ratePerAppointment: z.number().int().min(0, 'A rate cannot be negative.'),
  currency: z.string().length(3).default('GBP'),
  contactName: z.string().min(1).max(160),
  contactEmail: z.string().email('Enter a valid contact email.'),
  billingEmail: z.string().email('Enter a valid billing email.'),
  rateLimitPerMinute: z.number().int().min(1).max(6000).default(60),
  branding: brandingSchema,
});

/**
 * POST /api/admin/partners
 *
 * Creates the partner and issues both a live and a sandbox credential in the
 * same step. Issuing them together matters: a partner who has to come back and
 * ask for sandbox credentials will just develop against live instead.
 *
 * The two secrets are returned here and never again.
 */
adminPartnersRouter.post(
  '/',
  handle(async (req, res) => {
    const input = createPartner.parse(req.body);
    const slug = slugify(input.slug ?? input.name);
    if (!slug) throw badRequest('That name does not produce a usable slug.');

    const existing = await prisma.partner.findUnique({ where: { slug } });
    if (existing) throw conflict('A partner with that slug already exists.', 'SLUG_TAKEN');

    const live = issueCredentialValues(slug, false);
    const sandbox = issueCredentialValues(slug, true);
    const { hash } = await import('bcryptjs');

    const partner = await prisma.partner.create({
      data: {
        name: input.name,
        slug,
        status: input.status === 'active' ? 'ACTIVE' : 'SUSPENDED',
        integration: input.integration === 'api' ? 'API' : 'EMBED',
        ratePerAppointment: input.ratePerAppointment,
        currency: input.currency.toUpperCase(),
        contactName: input.contactName,
        contactEmail: input.contactEmail,
        billingEmail: input.billingEmail,
        rateLimitPerMinute: input.rateLimitPerMinute,
        brandPrimaryColor: input.branding.primaryColor,
        brandAccentColor: input.branding.accentColor,
        brandFontFamily: input.branding.fontFamily,
        brandLogoUrl: input.branding.logoUrl ?? null,
        brandDisplayName: input.branding.displayName,
        credentials: {
          create: [
            {
              clientId: live.clientId,
              secretHash: await hash(live.secret, 10),
              secretLastFour: live.secret.slice(-4),
              isSandbox: false,
            },
            {
              clientId: sandbox.clientId,
              secretHash: await hash(sandbox.secret, 10),
              secretLastFour: sandbox.secret.slice(-4),
              isSandbox: true,
            },
          ],
        },
      },
      include: { credentials: { orderBy: { createdAt: 'desc' } } },
    });

    return ok(
      res,
      {
        partner: serialisePartner(partner),
        // Shown once. There is no route that returns these again, by design.
        secrets: {
          live: { clientId: live.clientId, secret: live.secret },
          sandbox: { clientId: sandbox.clientId, secret: sandbox.secret },
        },
      },
      undefined,
      201
    );
  })
);

const updatePartner = createPartner.partial().omit({ slug: true });

/** PUT /api/admin/partners/:id */
adminPartnersRouter.put(
  '/:id',
  handle(async (req, res) => {
    const input = updatePartner.parse(req.body);
    await loadPartner(String(req.params.id));

    const partner = await prisma.partner.update({
      where: { id: String(req.params.id) },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.status !== undefined
          ? { status: input.status === 'active' ? 'ACTIVE' : 'SUSPENDED' }
          : {}),
        ...(input.integration !== undefined
          ? { integration: input.integration === 'api' ? 'API' : 'EMBED' }
          : {}),
        // Changing the rate never restates an invoice already raised: each one
        // captured its own rate at generation.
        ...(input.ratePerAppointment !== undefined
          ? { ratePerAppointment: input.ratePerAppointment }
          : {}),
        ...(input.currency !== undefined ? { currency: input.currency.toUpperCase() } : {}),
        ...(input.contactName !== undefined ? { contactName: input.contactName } : {}),
        ...(input.contactEmail !== undefined ? { contactEmail: input.contactEmail } : {}),
        ...(input.billingEmail !== undefined ? { billingEmail: input.billingEmail } : {}),
        ...(input.rateLimitPerMinute !== undefined
          ? { rateLimitPerMinute: input.rateLimitPerMinute }
          : {}),
        ...(input.branding
          ? {
              brandPrimaryColor: input.branding.primaryColor,
              brandAccentColor: input.branding.accentColor,
              brandFontFamily: input.branding.fontFamily,
              brandLogoUrl: input.branding.logoUrl ?? null,
              brandDisplayName: input.branding.displayName,
            }
          : {}),
      },
      include: { credentials: { orderBy: { createdAt: 'desc' } } },
    });

    return ok(res, { partner: serialisePartner(partner) });
  })
);

const rotateSchema = z.object({ sandbox: z.boolean().default(false) });

/**
 * POST /api/admin/partners/:id/credentials/rotate
 *
 * Issues a new secret and gives the old one 24 hours to live, so a partner can
 * deploy the new value without an outage. Revoking outright is a separate,
 * deliberate act below.
 */
adminPartnersRouter.post(
  '/:id/credentials/rotate',
  handle(async (req, res) => {
    const { sandbox } = rotateSchema.parse(req.body ?? {});
    const partner = await loadPartner(String(req.params.id));
    const values = issueCredentialValues(partner.slug, sandbox);
    const { hash } = await import('bcryptjs');

    await prisma.partnerCredential.updateMany({
      where: { partnerId: partner.id, isSandbox: sandbox, revokedAt: null, expiresAt: null },
      data: { expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) },
    });

    const credential = await prisma.partnerCredential.create({
      data: {
        partnerId: partner.id,
        clientId: values.clientId,
        secretHash: await hash(values.secret, 10),
        secretLastFour: values.secret.slice(-4),
        isSandbox: sandbox,
      },
    });

    return ok(res, {
      clientId: credential.clientId,
      secret: values.secret,
      isSandbox: sandbox,
      warning:
        'Copy this secret now. It is not stored and cannot be shown again. The previous secret keeps working for 24 hours.',
    });
  })
);

/**
 * POST /api/admin/partners/:id/credentials/:credentialId/revoke
 *
 * Immediate, with no grace period. This is the button for a leaked secret, so
 * it has to be the one thing that stops it working straight away.
 */
adminPartnersRouter.post(
  '/:id/credentials/:credentialId/revoke',
  handle(async (req, res) => {
    const partner = await loadPartner(String(req.params.id));
    const credential = await prisma.partnerCredential.findUnique({
      where: { id: String(req.params.credentialId) },
    });

    if (!credential || credential.partnerId !== partner.id) {
      throw notFound('That credential could not be found.');
    }

    const live = await prisma.partnerCredential.count({
      where: {
        partnerId: partner.id,
        isSandbox: credential.isSandbox,
        revokedAt: null,
        id: { not: credential.id },
      },
    });

    // Refusing to revoke the last one is deliberate. Rotate first, then revoke,
    // otherwise a partner is silently cut off with no way back in.
    if (live === 0) {
      throw badRequest(
        'That is the only credential of its kind. Rotate first, then revoke the old one.',
        'LAST_CREDENTIAL'
      );
    }

    await prisma.partnerCredential.update({
      where: { id: credential.id },
      data: { revokedAt: new Date() },
    });

    return ok(res, { revoked: true });
  })
);
