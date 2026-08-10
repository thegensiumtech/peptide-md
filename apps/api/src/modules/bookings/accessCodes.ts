import { createHash, randomInt, timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '@peptide/database';
import { config, isProduction } from '../../config';
import { logger } from '../../logger';
import { badRequest, unauthorized } from '../../http/errors';
import { emailProviderName, sendEmail } from '../../email';
import { accessCodeNotice } from '../../email/templates';
import { getSettings } from './service';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** The address whose inbox the caller has proved control of. */
      manageEmail?: string;
    }
  }
}

/** Long enough to find the email, short enough that a shoulder-surfed code dies. */
const CODE_TTL_MINUTES = 10;

/** Six digits is a million combinations; five guesses makes brute force useless. */
const ATTEMPT_LIMIT = 5;

/** Stops a resend button being used to mailbomb someone. */
const RESEND_COOLDOWN_SECONDS = 60;

/**
 * How long the screens stay open after a code is accepted. Deliberately short —
 * these screens show clinical appointments and are often opened on a phone that
 * is then put down.
 */
const SESSION_TTL_MINUTES = 30;

const ISSUER = 'peptide-md';

/**
 * Whether the code may be handed back to the browser instead of only emailed.
 *
 * Two locks, both of which must be open. A production build never qualifies,
 * and neither does any environment wired to a provider that genuinely delivers
 * — so this can only be true where the email goes nowhere and the code would
 * otherwise have to be dug out of the server log.
 *
 * Read once at boot rather than per request, so no runtime value can flip it.
 */
export const CODES_ARE_EXPOSED = !isProduction && emailProviderName === 'console';

if (CODES_ARE_EXPOSED) {
  logger.warn(
    'Access codes are returned to the browser because email is not being delivered. This is development behaviour and cannot happen in production.'
  );
}

interface ManageTokenPayload {
  sub: string;
  scope: 'manage';
}

const hashCode = (code: string) => createHash('sha256').update(code).digest('hex');

/** Constant-time, so a wrong code cannot be narrowed by how long it took to reject. */
function hashesMatch(a: string, b: string): boolean {
  const left = Buffer.from(a, 'hex');
  const right = Buffer.from(b, 'hex');
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/** Uniform across all million values — Math.random is not, and this is a credential. */
const generateCode = () => String(randomInt(0, 1_000_000)).padStart(6, '0');

// --- Issuing -----------------------------------------------------------------

/**
 * Email a fresh code, if the address has anything to show.
 *
 * Returns the code only so the caller can decide whether to expose it — see
 * CODES_ARE_EXPOSED. Whether one was issued says nothing to the outside world:
 * the endpoint reports the same thing either way, so asking for a code cannot
 * be used to discover who is a patient, which is the whole reason this step
 * exists.
 */
export async function requestAccessCode(
  email: string,
  requestIp?: string
): Promise<string | null> {
  const now = new Date();

  // The cooldown protects a real inbox from being flooded. Where nothing is
  // delivered there is no inbox to protect, and holding the cooldown would only
  // mean a developer clicking twice gets no visible code back.
  if (!CODES_ARE_EXPOSED) {
    const recent = await prisma.manageAccessCode.findFirst({
      where: {
        email,
        consumedAt: null,
        expiresAt: { gt: now },
        createdAt: { gt: new Date(now.getTime() - RESEND_COOLDOWN_SECONDS * 1000) },
      },
    });

    if (recent) {
      logger.info('Access code requested inside the cooldown — not resending');
      return null;
    }
  }

  // Never email an address that has nothing here. A stranger typed into the
  // form must not receive anything at all — and must not be shown a code
  // either, so this check runs before any code exists.
  const bookings = await prisma.booking.count({
    where: { patient: { email }, status: { not: 'PENDING_PAYMENT' } },
  });

  if (bookings === 0) {
    logger.info('Access code requested for an address with no bookings — nothing sent');
    return null;
  }

  // Only the newest code works. An older one left live would widen the window
  // for anyone who saw an earlier email.
  await prisma.manageAccessCode.updateMany({
    where: { email, consumedAt: null, expiresAt: { gt: now } },
    data: { consumedAt: now },
  });

  const code = generateCode();
  const expiresAt = new Date(now.getTime() + CODE_TTL_MINUTES * 60_000);

  await prisma.manageAccessCode.create({
    data: { email, codeHash: hashCode(code), expiresAt, requestIp: requestIp ?? null },
  });

  const settings = await getSettings();
  await sendEmail(
    'MANAGE_ACCESS_CODE',
    accessCodeNotice({
      to: email,
      code,
      minutes: CODE_TTL_MINUTES,
      fromName: settings.emailFromName,
      fromEmail: settings.emailFromAddress,
    })
  );

  return code;
}

// --- Verifying ---------------------------------------------------------------

export interface ManageSession {
  token: string;
  email: string;
  expiresAt: string;
}

/**
 * Check a code and open a session.
 *
 * Every failure returns the same message. Distinguishing "no code outstanding"
 * from "wrong digits" would tell an attacker whether their guessing is even
 * pointed at a real request.
 */
export async function verifyAccessCode(email: string, code: string): Promise<ManageSession> {
  const rejection = badRequest(
    'That code is not right, or it has expired. Ask for a new one.',
    'BAD_CODE'
  );

  const record = await prisma.manageAccessCode.findFirst({
    where: { email, consumedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
  });

  if (!record) throw rejection;

  if (record.attempts >= ATTEMPT_LIMIT) {
    await prisma.manageAccessCode.update({
      where: { id: record.id },
      data: { consumedAt: new Date() },
    });
    logger.warn('Access code burned after too many attempts');
    throw rejection;
  }

  if (!hashesMatch(record.codeHash, hashCode(code))) {
    const { attempts } = await prisma.manageAccessCode.update({
      where: { id: record.id },
      data: { attempts: { increment: 1 } },
      select: { attempts: true },
    });
    // Spend the last guess rather than leaving a nearly-dead code alive.
    if (attempts >= ATTEMPT_LIMIT) {
      await prisma.manageAccessCode.update({
        where: { id: record.id },
        data: { consumedAt: new Date() },
      });
    }
    throw rejection;
  }

  // Single use. The code is spent the moment it works.
  await prisma.manageAccessCode.update({
    where: { id: record.id },
    data: { consumedAt: new Date() },
  });

  const expiresAt = new Date(Date.now() + SESSION_TTL_MINUTES * 60_000);
  const payload: ManageTokenPayload = { sub: email, scope: 'manage' };
  const token = jwt.sign(payload, config.JWT_SECRET, {
    expiresIn: `${SESSION_TTL_MINUTES}m`,
    issuer: ISSUER,
  } as jwt.SignOptions);

  logger.info('Patient opened a self-service session');
  return { token, email, expiresAt: expiresAt.toISOString() };
}

// --- Guarding ----------------------------------------------------------------

/**
 * Gate for every self-service endpoint.
 *
 * The address comes off the verified token and never off the request body, so
 * a caller cannot ask about someone else's appointments by editing a field.
 */
export function requireManageSession(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;

  if (!token) {
    return next(unauthorized('Confirm your email address to continue.'));
  }

  try {
    const payload = jwt.verify(token, config.JWT_SECRET, { issuer: ISSUER }) as ManageTokenPayload;
    if (payload.scope !== 'manage' || !payload.sub) throw new Error('Wrong audience');
    req.manageEmail = payload.sub.toLowerCase();
    return next();
  } catch {
    // A staff token must not open a patient's screens, and vice versa — the
    // scope check above is what keeps the two apart.
    return next(unauthorized('Your session has expired. Confirm your email again.'));
  }
}

export function manageEmailOf(req: Request): string {
  if (!req.manageEmail) throw unauthorized('Confirm your email address to continue.');
  return req.manageEmail;
}

// --- Housekeeping ------------------------------------------------------------

/** Codes are short-lived credentials; spent and stale ones are not kept around. */
export async function purgeExpiredAccessCodes(): Promise<number> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const { count } = await prisma.manageAccessCode.deleteMany({
    where: { OR: [{ expiresAt: { lt: new Date() } }, { consumedAt: { lt: cutoff } }] },
  });
  if (count > 0) logger.info({ count }, 'Expired access codes purged');
  return count;
}
