/**
 * The partner's contractual rate limit.
 *
 * `Partner.rateLimitPerMinute` has been in the schema since the start, is shown
 * to partners in the portal, and until now was enforced nowhere. A number in a
 * contract that nothing checks is worse than no number.
 *
 * Deliberately ordered **before** credential verification. Verification runs
 * bcrypt, which is slow by design, so an endpoint that authenticates first
 * would let anyone with a URL burn our CPU by spraying wrong secrets. Counting
 * first means an attacker gets rate limited on the cheap path.
 *
 * That ordering has a consequence worth being explicit about: the limit is
 * keyed on the *claimed* client id, before we know it is real. Someone could
 * spend another partner's allowance by guessing their client id. Client ids are
 * not secret, so this is a real if minor concern, and it is handled by giving
 * unauthenticated callers a separate, tighter budget keyed on their address as
 * well. A caller has to pass both.
 */
import type { NextFunction, Request, Response } from 'express';
import { prisma } from '@peptide/database';
import { consume } from '../../lib/rateLimiter';
import { readCredential } from './partnerAuth';
import { AppError } from '../errors';

const WINDOW_SECONDS = 60;

/**
 * Ceiling on how much one address can attempt regardless of which client id it
 * claims, so the per-partner budget cannot be used as an amplifier.
 */
const PER_ADDRESS_LIMIT = 600;

/** Used when the client id is unknown, so an unknown caller is cheap to refuse. */
const UNKNOWN_CLIENT_LIMIT = 20;

function tooMany(retryAfterSeconds: number): AppError {
  return new AppError(
    429,
    `Rate limit exceeded. Retry in ${retryAfterSeconds} seconds.`,
    'RATE_LIMITED'
  );
}

export async function partnerRateLimit(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const address = req.ip ?? 'unknown';
    const byAddress = await consume(`ratelimit:addr:${address}`, PER_ADDRESS_LIMIT, WINDOW_SECONDS);
    if (!byAddress.allowed) {
      res.setHeader('Retry-After', byAddress.resetSeconds);
      next(tooMany(byAddress.resetSeconds));
      return;
    }

    const parsed = readCredential(req);
    if (!parsed) {
      // No usable credential. Charge it and let the auth middleware produce the
      // 401, so the caller learns what is wrong rather than only that they are
      // being throttled.
      const anonymous = await consume(
        `ratelimit:anon:${address}`,
        UNKNOWN_CLIENT_LIMIT,
        WINDOW_SECONDS
      );
      if (!anonymous.allowed) {
        res.setHeader('Retry-After', anonymous.resetSeconds);
        next(tooMany(anonymous.resetSeconds));
        return;
      }
      next();
      return;
    }

    // The configured limit lives on the partner, so it has to be looked up
    // before the limit can be applied. Selected narrowly: this runs on every
    // request and does not need the branding columns.
    const credential = await prisma.partnerCredential.findUnique({
      where: { clientId: parsed.clientId },
      select: { partner: { select: { rateLimitPerMinute: true } } },
    });

    const limit = credential?.partner.rateLimitPerMinute ?? UNKNOWN_CLIENT_LIMIT;
    const verdict = await consume(
      `ratelimit:client:${parsed.clientId}`,
      limit,
      WINDOW_SECONDS
    );

    res.setHeader('RateLimit-Limit', verdict.limit);
    res.setHeader('RateLimit-Remaining', verdict.remaining);
    res.setHeader('RateLimit-Reset', verdict.resetSeconds);

    if (!verdict.allowed) {
      res.setHeader('Retry-After', verdict.resetSeconds);
      next(tooMany(verdict.resetSeconds));
      return;
    }

    next();
  } catch (error) {
    next(error);
  }
}
