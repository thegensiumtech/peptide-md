import { createHash, randomBytes } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { prisma, type UserRole } from '@peptide/database';
import { config } from '../../config';
import { unauthorized } from '../../http/errors';

const REFRESH_TTL_DAYS = 30;

export interface AccessTokenPayload {
  sub: string;
  role: UserRole;
  /** Present only for PARTNER users — the tenant boundary, carried in the token. */
  partnerId: string | null;
  doctorId: string | null;
}

export function signAccessToken(payload: AccessTokenPayload): string {
  // expiresIn is a config string ('8h'), which the current @types/jsonwebtoken
  // models as a narrow literal union rather than string.
  const options = {
    expiresIn: config.JWT_EXPIRES_IN,
    issuer: 'peptide-md',
  } as jwt.SignOptions;

  return jwt.sign(payload, config.JWT_SECRET, options);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  try {
    return jwt.verify(token, config.JWT_SECRET, { issuer: 'peptide-md' }) as AccessTokenPayload;
  } catch {
    throw unauthorized('Your session has expired. Sign in again.');
  }
}

/** Refresh tokens are stored hashed — a database leak must not yield live sessions. */
const hash = (token: string) => createHash('sha256').update(token).digest('hex');

export async function issueRefreshToken(userId: string): Promise<string> {
  const token = randomBytes(40).toString('hex');
  const expiresAt = new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000);

  await prisma.refreshToken.create({
    data: { tokenHash: hash(token), userId, expiresAt },
  });

  return token;
}

export async function consumeRefreshToken(token: string): Promise<string> {
  const record = await prisma.refreshToken.findUnique({ where: { tokenHash: hash(token) } });

  if (!record || record.revokedAt || record.expiresAt < new Date()) {
    throw unauthorized('Your session has expired. Sign in again.');
  }

  // Rotate on use: a refresh token is single-use, so a stolen one is only
  // valid until the legitimate holder next refreshes.
  await prisma.refreshToken.update({
    where: { id: record.id },
    data: { revokedAt: new Date() },
  });

  return record.userId;
}

export async function revokeAllRefreshTokens(userId: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
