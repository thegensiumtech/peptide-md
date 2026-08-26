import { createApp } from './app';
import { config, assertProductionReadiness } from './config';
import { logger } from './logger';
import { connectRedis } from './lib/redis';
import { releaseExpiredHolds, sendDueReminders } from './modules/bookings/service';
import { purgeExpiredAccessCodes } from './modules/bookings/accessCodes';
import { startMonthlyInvoicing } from './modules/invoicing/scheduler';

async function main() {
  assertProductionReadiness((message) => logger.warn(message));
  await connectRedis();

  const app = createApp();
  const server = app.listen(config.API_PORT, () => {
    logger.info(`Peptide MD API listening on http://localhost:${config.API_PORT}`);
  });

  /**
   * Housekeeping. Runs in-process for now; in production these move to a
   * scheduled job so they do not depend on a particular instance being up.
   */
  const sweep = setInterval(() => {
    releaseExpiredHolds().catch((error) => logger.error({ err: error }, 'Hold sweep failed'));
    // Access codes are short-lived credentials; spent and stale ones are not
    // left lying in the table.
    purgeExpiredAccessCodes().catch((error) =>
      logger.error({ err: error }, 'Access code purge failed')
    );
  }, 60_000);

  const reminders = setInterval(() => {
    sendDueReminders().catch((error) => logger.error({ err: error }, 'Reminder sweep failed'));
  }, 15 * 60_000);

  // Hourly, and once at boot. Asks whether the month just finished has been
  // invoiced rather than counting down to the 1st, so a restart or an outage
  // over month end cannot silently skip a month's billing.
  const invoicing = startMonthlyInvoicing();

  const shutdown = (signal: string) => {
    logger.info({ signal }, 'Shutting down');
    clearInterval(sweep);
    clearInterval(reminders);
    clearInterval(invoicing);
    server.close(() => process.exit(0));
    // Do not let a hung connection block the deploy indefinitely.
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((error) => {
  logger.error({ err: error }, 'Failed to start');
  process.exit(1);
});
