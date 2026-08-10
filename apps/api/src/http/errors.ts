import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { logger } from '../logger';
import { isProduction } from '../config';

/**
 * Errors the API raises deliberately. Anything else is a bug and is reported
 * as a 500 with a generic message — internal detail never reaches a client.
 */
export class AppError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code?: string
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const badRequest = (message: string, code?: string) => new AppError(400, message, code);
export const unauthorized = (message = 'Sign in to continue.') => new AppError(401, message);
export const forbidden = (message = 'You do not have access to that.') => new AppError(403, message);
export const notFound = (message = 'Not found.') => new AppError(404, message);
export const conflict = (message: string, code?: string) => new AppError(409, message, code);

export function ok<T>(res: Response, data: T, meta?: unknown, status = 200) {
  return res.status(status).json(meta ? { success: true, data, error: null, meta } : { success: true, data, error: null });
}

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ success: false, data: null, error: 'Not found.' });
}

/** Terminal error handler. Every failure leaves through here in one shape. */
export function errorHandler(error: unknown, req: Request, res: Response, _next: NextFunction) {
  if (error instanceof ZodError) {
    const detail = error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    return res.status(400).json({ success: false, data: null, error: detail });
  }

  if (error instanceof AppError) {
    // Expected failures are logged at info — they are not incidents.
    logger.info({ status: error.status, path: req.path, code: error.code }, error.message);
    return res
      .status(error.status)
      .json({ success: false, data: null, error: error.message, code: error.code });
  }

  logger.error({ err: error, path: req.path, method: req.method }, 'Unhandled error');
  return res.status(500).json({
    success: false,
    data: null,
    error: isProduction
      ? 'Something went wrong on our side. Please try again.'
      : error instanceof Error
        ? error.message
        : 'Unknown error',
  });
}

/** Wraps an async handler so a rejected promise reaches the error handler. */
export function handle<T extends Request>(
  fn: (req: T, res: Response, next: NextFunction) => Promise<unknown>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req as T, res, next).catch(next);
  };
}
