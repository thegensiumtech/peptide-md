import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { prisma } from '@peptide/database';
import { handle, notFound, ok } from '../../http/errors';
import { config } from '../../config';
import { sendEmail } from '../../email';
import { guideDelivery } from '../../email/templates';

export const guideRouter = Router();

/** A public form is a spam target, so requests are capped per address. */
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, data: null, error: 'Too many requests. Try again shortly.' },
});

const request = z.object({
  name: z.string().min(1, 'Tell us what to call you.').max(120),
  email: z.string().email('Enter a valid email address.'),
  marketingConsent: z.boolean().default(false),
  source: z.string().max(60).default('website'),
  /**
   * Honeypot. Accepts anything on purpose, validating it to empty would
   * return a 400 and tell a bot precisely which field caught it. It is read
   * and discarded below instead.
   */
  website: z.string().optional(),
});

const CONSENT_WORDING =
  'I would like Peptide MD to email me occasionally about peptide therapy and the consultation service. I can unsubscribe at any time.';

/**
 * The lead magnet.
 *
 * Kept out of the Patient table on purpose, someone who downloads a guide has
 * not booked anything, and marketing contacts do not belong in a clinical
 * record. The download is not conditional on marketing consent: the guide is
 * the exchange for an email address, nothing more.
 */
guideRouter.post(
  '/request',
  limiter,
  handle(async (req, res) => {
    const input = request.parse(req.body);

    // Silently accept and discard, so a bot learns nothing from the response.
    if (input.website) return ok(res, { sent: true });

    const email = input.email.toLowerCase().trim();
    const downloadToken = randomBytes(24).toString('hex');

    const record = await prisma.guideRequest.create({
      data: {
        name: input.name.trim(),
        email,
        source: input.source,
        downloadToken,
        marketingConsent: input.marketingConsent,
        consentWording: CONSENT_WORDING,
        ipAddress: req.ip ?? null,
      },
    });

    const downloadUrl = `${config.WEB_URL}/guide/download/${downloadToken}`;
    const sent = await sendEmail('GUIDE_DELIVERY', guideDelivery(record.name, email, downloadUrl));

    // Stamped only on a real send. Previously this was set unconditionally, so
    // the admin panel showed a guide as delivered when SES had rejected it.
    if (sent) {
      await prisma.guideRequest.update({
        where: { id: record.id },
        data: { emailSentAt: new Date() },
      });
    }

    // The download link is returned either way, so the browser can offer the
    // guide at once rather than making someone wait on an inbox, and so a
    // failed send still leaves the person with what they asked for.
    return ok(res, { sent, downloadUrl });
  })
);

/** Resolve a download token. The file itself is served by the web app. */
guideRouter.get(
  '/download/:token',
  handle(async (req, res) => {
    const record = await prisma.guideRequest.findUnique({
      where: { downloadToken: req.params.token! },
    });
    if (!record) throw notFound('That download link is not valid.');

    await prisma.guideRequest.update({
      where: { id: record.id },
      data: { downloadCount: { increment: 1 }, lastDownloadAt: new Date() },
    });

    return ok(res, { file: '/guides/peptide-md-guide.pdf', name: record.name });
  })
);
