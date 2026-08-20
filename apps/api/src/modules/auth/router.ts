import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { prisma } from '@peptide/database';
import { handle, ok, unauthorized } from '../../http/errors';
import { requireAuth } from '../../http/middleware/auth';
import { isProduction } from '../../config';
import {
  consumeRefreshToken,
  issueRefreshToken,
  revokeAllRefreshTokens,
  signAccessToken,
} from './tokens';

export const authRouter = Router();

/**
 * Credential stuffing is the obvious attack on a login endpoint.
 *
 * Two decisions worth stating. Only *failed* attempts count, so a clinic where
 * the whole team shares one office IP cannot lock itself out by signing in
 * normally. And the key is the email plus the IP rather than the IP alone, so
 * one person fat-fingering their password does not lock out a colleague behind
 * the same NAT, while an attacker spraying many addresses still gets throttled
 * per address.
 */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.toLowerCase().trim() : '';
    return `${req.ip ?? 'unknown'}:${email}`;
  },
  message: { success: false, data: null, error: 'Too many attempts. Try again in a few minutes.' },
});

const credentials = z.object({
  email: z.string().email('Enter a valid email address.'),
  password: z.string().min(1, 'Enter your password.'),
});

const cookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: 'lax' as const,
  path: '/',
};

function publicUser(user: {
  id: string;
  email: string;
  name: string;
  role: string;
  partnerId: string | null;
  doctorId: string | null;
}) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role.toLowerCase(),
    partnerId: user.partnerId,
    doctorId: user.doctorId,
  };
}

authRouter.post(
  '/login',
  loginLimiter,
  handle(async (req, res) => {
    const { email, password } = credentials.parse(req.body);

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });

    // One message for both a missing account and a wrong password, and the
    // hash is always compared, so response timing does not reveal which
    // addresses exist.
    const hash = user?.passwordHash ?? '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinva';
    const valid = await bcrypt.compare(password, hash);

    if (!user || !valid || !user.isActive) {
      throw unauthorized('That email and password do not match.');
    }

    const accessToken = signAccessToken({
      sub: user.id,
      role: user.role,
      partnerId: user.partnerId,
      doctorId: user.doctorId,
    });
    const refreshToken = await issueRefreshToken(user.id);

    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    res.cookie('pmd_access', accessToken, { ...cookieOptions, maxAge: 8 * 60 * 60 * 1000 });
    res.cookie('pmd_refresh', refreshToken, { ...cookieOptions, maxAge: 30 * 24 * 60 * 60 * 1000 });

    return ok(res, { user: publicUser(user), accessToken });
  })
);

authRouter.post(
  '/refresh',
  handle(async (req, res) => {
    const token = (req.cookies?.pmd_refresh as string | undefined) ?? req.body?.refreshToken;
    if (!token) throw unauthorized('Sign in to continue.');

    const userId = await consumeRefreshToken(token);
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.isActive) throw unauthorized('Sign in to continue.');

    const accessToken = signAccessToken({
      sub: user.id,
      role: user.role,
      partnerId: user.partnerId,
      doctorId: user.doctorId,
    });
    const refreshToken = await issueRefreshToken(user.id);

    res.cookie('pmd_access', accessToken, { ...cookieOptions, maxAge: 8 * 60 * 60 * 1000 });
    res.cookie('pmd_refresh', refreshToken, { ...cookieOptions, maxAge: 30 * 24 * 60 * 60 * 1000 });

    return ok(res, { user: publicUser(user), accessToken });
  })
);

authRouter.post(
  '/logout',
  handle(async (req, res) => {
    if (req.user?.sub) await revokeAllRefreshTokens(req.user.sub);
    res.clearCookie('pmd_access', cookieOptions);
    res.clearCookie('pmd_refresh', cookieOptions);
    return ok(res, { signedOut: true });
  })
);

authRouter.get(
  '/me',
  requireAuth,
  handle(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.user!.sub } });
    if (!user || !user.isActive) throw unauthorized('Sign in to continue.');
    return ok(res, publicUser(user));
  })
);
