import { Router } from 'express';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { prisma } from '@peptide/database';
import { handle, notFound, ok } from '../../http/errors';
import { requireRole } from '../../http/middleware/auth';

/**
 * Shareable links to a partner's API documentation.
 *
 * The problem this solves: a partner's developers need the reference, but they
 * are not going to be given a login to the partner portal, and emailing a PDF
 * means the copy they hold drifts from the API the moment anything changes.
 *
 * A link is a bearer of read access to documentation and nothing else. The page
 * it opens shows the sandbox client id, which books a throwaway diary, and no
 * secret of any kind. That is what makes it safe to forward to a third party.
 */
export const adminDocsLinksRouter = Router();

adminDocsLinksRouter.use(requireRole('ADMIN'));

/**
 * 32 random bytes, url-safe.
 *
 * Long enough that guessing is not a threat model, which matters because the
 * link is the only thing standing between the internet and the page.
 */
function mintToken(): string {
  return randomBytes(32).toString('base64url');
}

const serialise = (link: {
  id: string;
  token: string;
  label: string;
  expiresAt: Date | null;
  revokedAt: Date | null;
  viewCount: number;
  lastViewedAt: Date | null;
  createdAt: Date;
}) => ({
  id: link.id,
  token: link.token,
  label: link.label,
  expiresAt: link.expiresAt?.toISOString() ?? null,
  revokedAt: link.revokedAt?.toISOString() ?? null,
  viewCount: link.viewCount,
  lastViewedAt: link.lastViewedAt?.toISOString() ?? null,
  createdAt: link.createdAt.toISOString(),
  // Computed here so every caller agrees on what "usable" means.
  active: !link.revokedAt && (!link.expiresAt || link.expiresAt.getTime() > Date.now()),
});

adminDocsLinksRouter.get(
  '/partners/:partnerId/docs-links',
  handle(async (req, res) => {
    const links = await prisma.docsShareLink.findMany({
      where: { partnerId: String(req.params.partnerId) },
      orderBy: { createdAt: 'desc' },
    });
    return ok(res, links.map(serialise));
  })
);

const createInput = z.object({
  label: z.string().max(120).default(''),
  /** Days until it stops working. Null or absent means it never expires. */
  expiresInDays: z.coerce.number().int().min(1).max(365).nullable().optional(),
});

adminDocsLinksRouter.post(
  '/partners/:partnerId/docs-links',
  handle(async (req, res) => {
    const partnerId = String(req.params.partnerId);
    const { label, expiresInDays } = createInput.parse(req.body ?? {});

    const partner = await prisma.partner.findUnique({ where: { id: partnerId } });
    if (!partner) throw notFound('That partner could not be found.');

    const link = await prisma.docsShareLink.create({
      data: {
        token: mintToken(),
        partnerId,
        label,
        createdBy: req.user!.sub,
        expiresAt: expiresInDays
          ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
          : null,
      },
    });

    await prisma.auditEvent.create({
      data: {
        userId: req.user!.sub,
        action: 'docsLink.create',
        entityType: 'Partner',
        entityId: partnerId,
        ipAddress: req.ip ?? null,
      },
    });

    return ok(res, serialise(link), undefined, 201);
  })
);

adminDocsLinksRouter.post(
  '/docs-links/:id/revoke',
  handle(async (req, res) => {
    const id = String(req.params.id);
    const existing = await prisma.docsShareLink.findUnique({ where: { id } });
    if (!existing) throw notFound('That link could not be found.');

    // Revoked rather than deleted, so the audit trail keeps the fact that a
    // link was once handed out and when it was withdrawn.
    const link = await prisma.docsShareLink.update({
      where: { id },
      data: { revokedAt: existing.revokedAt ?? new Date() },
    });

    await prisma.auditEvent.create({
      data: {
        userId: req.user!.sub,
        action: 'docsLink.revoke',
        entityType: 'Partner',
        entityId: existing.partnerId,
        ipAddress: req.ip ?? null,
      },
    });

    return ok(res, serialise(link));
  })
);
