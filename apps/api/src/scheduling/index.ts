import { config } from '../config';
import { logger } from '../logger';
import { InternalSchedulingProvider } from './internal';
import { CalComSchedulingProvider } from './calcom';
import type { SchedulingProvider } from './provider';

export * from './provider';

let instance: SchedulingProvider | null = null;

/**
 * Chooses the adapter once, at boot.
 *
 * Selecting `calcom` without credentials falls back to the internal provider
 * rather than failing every booking, a misconfiguration should degrade, not
 * take the diary offline.
 */
export function schedulingProvider(): SchedulingProvider {
  if (instance) return instance;

  if (config.SCHEDULING_PROVIDER === 'calcom') {
    if (config.CALCOM_CLIENT_ID && config.CALCOM_CLIENT_SECRET) {
      logger.info('Scheduling provider: cal.com');
      instance = new CalComSchedulingProvider();
      return instance;
    }
    logger.warn('SCHEDULING_PROVIDER=calcom but credentials are empty, using internal provider');
  }

  logger.info('Scheduling provider: internal');
  instance = new InternalSchedulingProvider();
  return instance;
}
