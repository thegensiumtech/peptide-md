/**
 * Authentication for the partner API.
 *
 * This is a different thing from `requirePartner` in ./auth. That one gates the
 * partner *portal*, where a human has signed in and carries a JWT. This one
 * gates the partner *API*, where another company's server calls us with a
 * credential pair we issued. Neither should be able to stand in for the other:
 * a portal session must not be able to write bookings, and an API credential
 * must not be able to read the portal.
 *
 * HTTP Basic, because it is the least surprising thing to hand a partner's
 * developer and every HTTP client on earth already implements it.
 *
 * Three things this has to get right:
 *
 *  - **Rotation must not cause an outage.** The schema gives a rotated
 *    credential a 24 hour `expiresAt` rather than killing it, so a partner can
 *    deploy the new secret in their own time. Both work during the overlap.
 *  - **bcrypt is slow on purpose.** That makes an unauthenticated endpoint that
 *    calls it a denial-of-service surface, so the rate limiter runs first and a
 *    successful verification is cached briefly. Postgres stays authoritative.
 *  - **Sandbox must not touch the real diary.** A sandbox credential resolves
 *    to a separate inactive doctor. The isolation is the doctor id, not a
 *    filter someone can forget to apply.
 */
import type { NextFunction, Request, Response } from 'express';
import { createHash } from 'node:crypto';
import { prisma } from '@peptide/database';
import type { Partner, PartnerCredential } from '@peptide/database';
import { unauthorized, forbidden } from '../errors';
import { cacheGet, cacheSet } from '../../lib/redis';
import { logger } from '../../logger';

export interface PartnerContext {
  partner: Partner;
  credential: PartnerCredential;
  isSandbox: boolean;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      partnerContext?: PartnerContext;
    }
  }
}

/** How long a verified pair is trusted without going back to bcrypt. */
const VERIFICATION_TTL_SECONDS = 60;

interface ParsedBasic {
  clientId: string;
  secret: string;
}

/**
 * Reads the credential without deciding whether it is valid.
 *
 * Split out so the rate limiter can key on `clientId` before any expensive
 * work happens. An unparseable header yields null and is charged to the IP
 * instead.
 */
export function readCredential(req: Request): ParsedBasic | null {
  const header = req.headers.authorization;
  if (!header?.startsWith('Basic ')) return null;

  let decoded: string;
  try {
    decoded = Buffer.from(header.slice(6), 'base64').toString('utf8');
  } catch {
    return null;
  }

  // The secret may itself contain a colon, so only the first one separates.
  const separator = decoded.indexOf(':');
  if (separator < 1) return null;

  const clientId = decoded.slice(0, separator);
  const secret = decoded.slice(separator + 1);
  if (!clientId || !secret) return null;

  return { clientId, secret };
}

const verificationKey = (clientId: string, secret: string): string =>
  `partnerauth:${createHash('sha256').update(`${clientId}:${secret}`).digest('hex')}`;

function isUsable(credential: PartnerCredential, now: Date): boolean {
  if (credential.revokedAt) return false;
  // expiresAt is only set when a credential has been rotated. Until it passes,
  // the old secret keeps working so the partner can cut over without downtime.
  if (credential.expiresAt && credential.expiresAt <= now) return false;
  return true;
}

export async function requirePartnerCredential(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  const parsed = readCredential(req);
  if (!parsed) {
    next(unauthorized('Provide your client id and secret using HTTP Basic authentication.'));
    return;
  }

  const now = new Date();

  try {
    const credential = await prisma.partnerCredential.findUnique({
      where: { clientId: parsed.clientId },
      include: { partner: true },
    });

    // The same answer for an unknown client id and a wrong secret. Telling a
    // caller which of the two was wrong turns this into a way of discovering
    // who our partners are.
    if (!credential || !isUsable(credential, now)) {
      next(unauthorized('Those credentials are not valid.'));
      return;
    }

    if (credential.partner.status !== 'ACTIVE') {
      next(forbidden('This partner account is suspended. Contact Peptide MD.'));
      return;
    }

    const cacheKey = verificationKey(parsed.clientId, parsed.secret);
    const cached = await cacheGet(cacheKey);

    if (cached !== credential.id) {
      const { compare } = await import('bcryptjs');
      const matches = await compare(parsed.secret, credential.secretHash);
      if (!matches) {
        next(unauthorized('Those credentials are not valid.'));
        return;
      }
      await cacheSet(cacheKey, credential.id, VERIFICATION_TTL_SECONDS);
    }

    req.partnerContext = {
      partner: credential.partner,
      credential,
      isSandbox: credential.isSandbox,
    };

    // Not awaited: a partner's request should not wait on our bookkeeping, and
    // losing one timestamp matters less than adding latency to every call.
    prisma.partnerCredential
      .update({ where: { id: credential.id }, data: { lastUsedAt: now } })
      .catch((error) => logger.warn({ err: error }, 'Could not stamp credential lastUsedAt'));

    next();
  } catch (error) {
    next(error);
  }
}

/** The partner for this request, read from the verified credential only. */
export function partnerContextOf(req: Request): PartnerContext {
  if (!req.partnerContext) {
    // Reaching here means a route was mounted without the middleware. That is
    // a wiring mistake, and it must fail loudly rather than fall through to a
    // query with no tenant filter.
    throw forbidden('This endpoint requires partner credentials.');
  }
  return req.partnerContext;
}
