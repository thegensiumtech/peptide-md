import pino from 'pino';
import { config, isProduction } from './config';

export const logger = pino({
  level: isProduction ? 'info' : 'debug',
  transport: isProduction ? undefined : { target: 'pino-pretty', options: { colorize: true } },
  // Patient data and secrets must never reach the log stream.
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.body.password',
      'req.body.patientEmail',
      'req.body.patientPhone',
      'req.body.intake',
      '*.passwordHash',
      '*.secretHash',
    ],
    censor: '[redacted]',
  },
  base: { service: 'peptide-api', env: config.NODE_ENV },
});
