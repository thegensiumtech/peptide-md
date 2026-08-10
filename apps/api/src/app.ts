import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import pinoHttp from 'pino-http';
import rateLimit from 'express-rate-limit';
import { config } from './config';
import { logger } from './logger';
import { errorHandler, notFoundHandler, ok } from './http/errors';
import { attachUser } from './http/middleware/auth';
import { authRouter } from './modules/auth/router';
import { publicBookingRouter } from './modules/bookings/publicRouter';
import { manageBookingRouter } from './modules/bookings/manageRouter';
import { webhookRouter } from './modules/webhooks/router';
import { adminRouter } from './modules/admin/router';
import { partnerRouter } from './modules/partner/router';
import { schedulingProvider } from './scheduling';
import { emailProviderName } from './email';

export function createApp() {
  const app = express();

  app.set('trust proxy', 1);

  // The webhook must see the raw body to verify Stripe's signature, so it is
  // mounted before the JSON parser rather than after it.
  app.use('/api/webhooks', webhookRouter);

  app.use(helmet());
  app.use(compression());
  app.use(
    cors({
      origin: [config.WEB_URL],
      credentials: true,
    })
  );
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());
  app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === '/api/health' } }));
  app.use(rateLimit({ windowMs: 60_000, limit: 300, standardHeaders: true, legacyHeaders: false }));
  app.use(attachUser);

  app.get('/api/health', (_req, res) =>
    ok(res, {
      status: 'ok',
      scheduling: schedulingProvider().name,
      email: emailProviderName,
      environment: config.NODE_ENV,
    })
  );

  app.use('/api/auth', authRouter);
  // Mounted before the booking router so patient self-service keeps its own,
  // tighter rate limit rather than sharing the booking flow's.
  app.use('/api/booking/manage', manageBookingRouter);
  app.use('/api/booking', publicBookingRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api/partner', partnerRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
