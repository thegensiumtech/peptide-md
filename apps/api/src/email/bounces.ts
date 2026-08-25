/**
 * What SES tells us after the fact.
 *
 * `sentAt` on an email log only ever meant SES accepted the message. Whether
 * it reached anyone is reported later, on this separate channel. Two things
 * are done with that:
 *
 *  - The log is corrected, so the clinic is not shown a delivery that did not
 *    happen.
 *  - Addresses that will never accept mail are suppressed, so we stop trying.
 *    Repeatedly mailing addresses that hard bounce, or anyone who has pressed
 *    "this is spam", is what gets a sender's access withdrawn.
 */
import { prisma } from '@peptide/database';
import { logger } from '../logger';

interface SesNotification {
  notificationType?: string;
  eventType?: string;
  mail?: { messageId?: string };
  bounce?: {
    bounceType?: string;
    bounceSubType?: string;
    bouncedRecipients?: Array<{ emailAddress?: string; diagnosticCode?: string }>;
  };
  complaint?: {
    complaintFeedbackType?: string;
    complainedRecipients?: Array<{ emailAddress?: string }>;
  };
}

/** Address comparison is case-insensitive in practice, so the table stores one form. */
export const normaliseAddress = (email: string): string => email.trim().toLowerCase();

export async function isSuppressed(email: string): Promise<boolean> {
  const row = await prisma.emailSuppression.findUnique({
    where: { email: normaliseAddress(email) },
  });
  return row !== null;
}

async function suppress(
  email: string,
  reason: 'HARD_BOUNCE' | 'COMPLAINT' | 'MANUAL',
  detail?: string
): Promise<void> {
  const address = normaliseAddress(email);
  await prisma.emailSuppression.upsert({
    where: { email: address },
    // A second bounce should not overwrite the first reason, which is the one
    // that explains why the address was suppressed in the first place.
    update: {},
    create: { email: address, reason, detail: detail ?? null },
  });
  logger.warn({ email: address, reason }, 'Address suppressed');
}

/**
 * Handles one SES notification.
 *
 * Returns quietly on anything unrecognised. SES adds event types over time and
 * an unknown one is not an error worth failing the request over, which would
 * only make SNS retry it forever.
 */
export async function recordDeliveryEvent(raw: string): Promise<void> {
  let event: SesNotification;
  try {
    event = JSON.parse(raw) as SesNotification;
  } catch {
    logger.warn('SES notification was not JSON');
    return;
  }

  const kind = (event.notificationType ?? event.eventType ?? '').toLowerCase();
  const messageId = event.mail?.messageId;

  if (kind === 'bounce' && event.bounce) {
    const permanent = event.bounce.bounceType === 'Permanent';
    const detail = [event.bounce.bounceType, event.bounce.bounceSubType]
      .filter(Boolean)
      .join(' / ');

    if (messageId) {
      await prisma.emailLog.updateMany({
        where: { providerMessageId: messageId },
        // sentAt is deliberately left as it was. It records that SES accepted
        // the message, which remains true; bouncedAt is what says it did not
        // arrive. Overwriting the first with the second would lose the fact
        // that we did hand it over.
        data: { bouncedAt: new Date(), deliveryDetail: detail },
      });
    }

    // Transient bounces are full mailboxes and greylisting. Those clear up,
    // and suppressing on one would lock out a legitimate patient.
    if (permanent) {
      for (const recipient of event.bounce.bouncedRecipients ?? []) {
        if (recipient.emailAddress) {
          await suppress(recipient.emailAddress, 'HARD_BOUNCE', recipient.diagnosticCode ?? detail);
        }
      }
    }
    return;
  }

  if (kind === 'complaint' && event.complaint) {
    const detail = event.complaint.complaintFeedbackType ?? 'complaint';

    if (messageId) {
      await prisma.emailLog.updateMany({
        where: { providerMessageId: messageId },
        data: { complainedAt: new Date(), deliveryDetail: detail },
      });
    }

    // Any complaint is permanent. Somebody marked us as spam; there is no
    // version of continuing to mail them that is acceptable.
    for (const recipient of event.complaint.complainedRecipients ?? []) {
      if (recipient.emailAddress) {
        await suppress(recipient.emailAddress, 'COMPLAINT', detail);
      }
    }
    return;
  }

  if (kind === 'delivery' && messageId) {
    // Nothing to correct, but it confirms the message genuinely landed.
    await prisma.emailLog.updateMany({
      where: { providerMessageId: messageId },
      data: { deliveryDetail: 'Delivered' },
    });
  }
}
