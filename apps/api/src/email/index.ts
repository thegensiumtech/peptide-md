import { prisma, type EmailType } from '@peptide/database';
import { config } from '../config';
import { logger } from '../logger';

export interface OutgoingEmail {
  to: string;
  subject: string;
  text: string;
  html: string;
  /** Calendar invite attached to confirmations and reschedules. */
  icsContent?: string;
  icsFilename?: string;
}

interface EmailProvider {
  readonly name: string;
  send(email: OutgoingEmail): Promise<{ messageId: string }>;
}

/** Prints the rendered email. Used until AWS SES credentials are in place. */
class ConsoleEmailProvider implements EmailProvider {
  readonly name = 'console';

  async send(email: OutgoingEmail) {
    logger.info(
      { to: email.to, subject: email.subject, hasInvite: Boolean(email.icsContent) },
      'Email (console provider — not delivered)'
    );
    logger.debug({ body: email.text }, 'Email body');
    return { messageId: `console_${Date.now()}` };
  }
}

/**
 * AWS SES. Left unconstructed until credentials and a verified sender domain
 * exist — SES rejects unverified senders, so switching this on before the
 * domain is verified would fail every send.
 */
class SesEmailProvider implements EmailProvider {
  readonly name = 'ses';

  async send(_email: OutgoingEmail): Promise<{ messageId: string }> {
    throw new Error(
      'SES provider not yet wired: add AWS credentials and verify the sender domain, then implement send() with @aws-sdk/client-sesv2.'
    );
  }
}

const provider: EmailProvider =
  config.EMAIL_PROVIDER === 'ses' && config.AWS_ACCESS_KEY_ID
    ? new SesEmailProvider()
    : new ConsoleEmailProvider();

/**
 * Send and record. Every send is logged against the booking so "did the
 * patient get their confirmation?" is answerable, and so a reminder cannot go
 * out twice.
 */
export async function sendEmail(
  type: EmailType,
  email: OutgoingEmail,
  bookingId?: string
): Promise<void> {
  const log = await prisma.emailLog.create({
    data: { bookingId: bookingId ?? null, type, recipient: email.to, subject: email.subject },
  });

  try {
    const { messageId } = await provider.send(email);
    await prisma.emailLog.update({
      where: { id: log.id },
      data: { sentAt: new Date(), providerMessageId: messageId },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown email failure';
    await prisma.emailLog.update({
      where: { id: log.id },
      data: { failedAt: new Date(), error: message },
    });
    // A failed email must not roll back a paid, confirmed booking. It is
    // recorded and can be resent from the admin panel.
    logger.error({ err: message, type, to: email.to }, 'Email send failed');
  }
}

export async function alreadySent(bookingId: string, type: EmailType): Promise<boolean> {
  const count = await prisma.emailLog.count({
    where: { bookingId, type, sentAt: { not: null } },
  });
  return count > 0;
}

export const emailProviderName = provider.name;
