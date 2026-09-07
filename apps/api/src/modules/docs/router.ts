import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { prisma } from '@peptide/database';
import { handle, notFound, ok } from '../../http/errors';

/**
 * Public resolver for a shared documentation link.
 *
 * Deliberately unauthenticated: the whole point is that a partner's developer,
 * who has no account here, can open the reference. The token in the URL is the
 * only credential, so two things follow.
 *
 * First, what comes back is the minimum needed to render documentation: the
 * partner's display name and their sandbox client id. No secret, no live client
 * id, no patient data, no other partner. Someone who finds the link learns that
 * a company integrates with us and can book a throwaway practice diary.
 *
 * Second, it is rate limited on its own, harder than the rest of the API, so
 * the token cannot be brute forced by walking the space from one host.
 */
export const docsRouter = Router();

const lookupLimiter = rateLimit({
  windowMs: 60_000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, data: null, error: 'Too many requests.', code: 'RATE_LIMITED' },
});

docsRouter.get(
  '/:token',
  lookupLimiter,
  handle(async (req, res) => {
    const token = String(req.params.token);

    const link = await prisma.docsShareLink.findUnique({
      where: { token },
      include: {
        partner: {
          include: {
            // Sandbox only. The live pair is never part of this response.
            credentials: { where: { revokedAt: null, isSandbox: true }, take: 1 },
          },
        },
      },
    });

    // A revoked link, an expired one and one that never existed all answer the
    // same way. Distinguishing them would confirm which tokens are real.
    const usable =
      link && !link.revokedAt && (!link.expiresAt || link.expiresAt.getTime() > Date.now());

    if (!usable) throw notFound('That documentation link is not available.');

    // Best effort: a failed counter update must never stop the page rendering.
    await prisma.docsShareLink
      .update({
        where: { id: link.id },
        data: { viewCount: { increment: 1 }, lastViewedAt: new Date() },
      })
      .catch(() => undefined);

    return ok(res, {
      partnerName: link.partner.brandDisplayName || link.partner.name,
      sandboxClientId: link.partner.credentials[0]?.clientId ?? null,
      label: link.label,
      expiresAt: link.expiresAt?.toISOString() ?? null,
    });
  })
);
