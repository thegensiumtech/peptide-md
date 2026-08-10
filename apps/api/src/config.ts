import { config as loadEnv } from 'dotenv';
import { resolve } from 'node:path';
import { z } from 'zod';

loadEnv({ path: resolve(__dirname, '../../../.env.local') });

/**
 * Configuration is validated once, at boot.
 *
 * A missing secret should stop the process immediately with a readable
 * message, not surface as an undefined at 3am on the first real payment.
 */
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().default(4000),
  API_URL: z.string().url().default('http://localhost:4000'),
  WEB_URL: z.string().url().default('http://localhost:3000'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  REDIS_URL: z.string().default('redis://localhost:6379'),

  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  JWT_EXPIRES_IN: z.string().default('8h'),

  STRIPE_SECRET_KEY: z.string().min(1, 'STRIPE_SECRET_KEY is required'),
  STRIPE_WEBHOOK_SECRET: z.string().default('whsec_REPLACE_ME'),

  SCHEDULING_PROVIDER: z.enum(['internal', 'calcom']).default('internal'),
  CALCOM_API_URL: z.string().default('https://api.cal.com/v2'),
  CALCOM_CLIENT_ID: z.string().default(''),
  CALCOM_CLIENT_SECRET: z.string().default(''),

  EMAIL_PROVIDER: z.enum(['console', 'ses']).default('console'),
  AWS_REGION: z.string().default('eu-west-2'),
  AWS_ACCESS_KEY_ID: z.string().default(''),
  AWS_SECRET_ACCESS_KEY: z.string().default(''),
  SES_FROM_EMAIL: z.string().default('appointments@peptidemd.com'),
  SES_FROM_NAME: z.string().default('Peptides MD'),
  // Replies need somewhere real to land; the sending address is a domain
  // identity with no mailbox behind it.
  SES_REPLY_TO: z.string().default(''),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n');
  throw new Error(`Invalid environment configuration:\n${issues}`);
}

export const config = parsed.data;

export const isProduction = config.NODE_ENV === 'production';

/**
 * Guards that stop a half-configured service reaching production. In
 * development these degrade to warnings so the platform still runs before the
 * Cal.com and SES accounts exist.
 */
export function assertProductionReadiness(warn: (message: string) => void): void {
  const problems: string[] = [];

  if (config.STRIPE_WEBHOOK_SECRET === 'whsec_REPLACE_ME') {
    problems.push('STRIPE_WEBHOOK_SECRET is still the placeholder — webhooks cannot be verified');
  }
  if (config.SCHEDULING_PROVIDER === 'calcom' && !config.CALCOM_CLIENT_ID) {
    problems.push('SCHEDULING_PROVIDER is calcom but CALCOM_CLIENT_ID is empty');
  }
  if (config.EMAIL_PROVIDER === 'ses' && !config.AWS_ACCESS_KEY_ID) {
    problems.push('EMAIL_PROVIDER is ses but AWS credentials are empty');
  }
  if (isProduction && config.JWT_SECRET.startsWith('dev-only')) {
    problems.push('JWT_SECRET is still the development value');
  }

  if (problems.length === 0) return;
  if (isProduction) throw new Error(`Refusing to start in production:\n  ${problems.join('\n  ')}`);
  problems.forEach(warn);
}
