import type { NextFunction, Request, Response } from 'express';
import type { UserRole } from '@peptide/database';
import { forbidden, unauthorized } from '../errors';
import { verifyAccessToken, type AccessTokenPayload } from '../../modules/auth/tokens';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AccessTokenPayload;
    }
  }
}

/** Reads the bearer token if present. Does not reject, use `requireAuth` for that. */
export function attachUser(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const cookie = req.cookies?.pmd_access as string | undefined;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : cookie;

  if (token) {
    try {
      req.user = verifyAccessToken(token);
    } catch {
      // An invalid token is treated as no token; protected routes still reject.
    }
  }
  next();
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) return next(unauthorized());
  next();
}

export function requireRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(unauthorized());
    if (!roles.includes(req.user.role)) {
      return next(forbidden('That is not part of your access.'));
    }
    next();
  };
}

/**
 * The partner tenant boundary.
 *
 * The partner id is taken from the verified token and never from the request,
 * so a partner cannot reach another partner's data by changing a parameter.
 * The scope requires this to be enforced in the API layer, not the front end.
 */
export function requirePartner(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) return next(unauthorized());
  if (req.user.role !== 'PARTNER' || !req.user.partnerId) {
    return next(forbidden('That is not part of your access.'));
  }
  next();
}

export function partnerIdOf(req: Request): string {
  if (!req.user?.partnerId) throw forbidden('That is not part of your access.');
  return req.user.partnerId;
}
