import { prisma, type EmailType } from '@peptide/database';
import { config } from '../config';
import { logger } from '../logger';
import { isSuppressed } from './bounces';

export interface OutgoingEmail {
  to: string;
  subject: string;
  text: string;
  html: string;
  /** Calendar invite attached to confirmations and reschedules. */
  icsContent?: string;
  icsFilename?: string;
  /**
   * One-click unsubscribe. Set on anything a recipient could reasonably regard
   * as marketing, so their mail client offers an unsubscribe button rather than
   * a spam button, which is the outcome that actually costs a sender.
   */
  unsubscribeUrl?: string;
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
      'Email (console provider, not delivered)'
    );
    logger.debug({ body: email.text }, 'Email body');
    return { messageId: `console_${Date.now()}` };
  }
}

/**
 * AWS SES. Left unconstructed until credentials and a verified sender domain
 * exist. SES rejects unverified senders, so switching this on before the
 * domain is verified would fail every send.
 */
class SesEmailProvider implements EmailProvider {
  readonly name = 'ses';

  /**
   * Sent as raw MIME rather than the simple API, because every confirmation
   * carries a calendar invite and the simple API cannot attach one.
   *
   * The invite is marked `method=REQUEST` so mail clients offer to add it to
   * the recipient's calendar instead of treating it as a file download.
   */
  async send(email: OutgoingEmail): Promise<{ messageId: string }> {
    const { SESv2Client, SendEmailCommand } = await import('@aws-sdk/client-sesv2');
    const client = new SESv2Client({ region: config.AWS_REGION });

    const boundary = `pmd_${Date.now().toString(36)}`;
    const from = `${config.SES_FROM_NAME} <${config.SES_FROM_EMAIL}>`;
    const encode = (value: string) =>
      `=?UTF-8?B?${Buffer.from(value, 'utf8').toString('base64')}?=`;

    const parts = [
      `From: ${from}`,
      `To: ${email.to}`,
      ...(config.SES_REPLY_TO ? [`Reply-To: ${config.SES_REPLY_TO}`] : []),
      ...(email.unsubscribeUrl
        ? [
            `List-Unsubscribe: <${email.unsubscribeUrl}>`,
            'List-Unsubscribe-Post: List-Unsubscribe=One-Click',
          ]
        : []),
      `Subject: ${encode(email.subject)}`,
      'MIME-Version: 1.0',
      `Content-Type: multipart/mixed; boundary="${boundary}"`,
      '',
      `--${boundary}`,
      `Content-Type: multipart/alternative; boundary="alt_${boundary}"`,
      '',
      `--alt_${boundary}`,
      'Content-Type: text/plain; charset=UTF-8',
      'Content-Transfer-Encoding: base64',
      '',
      Buffer.from(email.text, 'utf8').toString('base64'),
      '',
      `--alt_${boundary}`,
      'Content-Type: text/html; charset=UTF-8',
      'Content-Transfer-Encoding: base64',
      '',
      Buffer.from(email.html, 'utf8').toString('base64'),
      '',
      `--alt_${boundary}--`,
      '',
    ];

    if (email.icsContent) {
      parts.push(
        `--${boundary}`,
        `Content-Type: text/calendar; charset=UTF-8; method=REQUEST; name="${email.icsFilename ?? 'appointment.ics'}"`,
        'Content-Transfer-Encoding: base64',
        `Content-Disposition: attachment; filename="${email.icsFilename ?? 'appointment.ics'}"`,
        '',
        Buffer.from(email.icsContent, 'utf8').toString('base64'),
        ''
      );
    }

    parts.push(`--${boundary}--`, '');

    const result = await client.send(
      new SendEmailCommand({
        Content: { Raw: { Data: Buffer.from(parts.join('\r\n'), 'utf8') } },
      })
    );

    return { messageId: result.MessageId ?? `ses_${Date.now()}` };
  }
}

const provider: EmailProvider =
  config.EMAIL_PROVIDER === 'ses' ? new SesEmailProvider() : new ConsoleEmailProvider();

/**
 * Send and record. Every send is logged against the booking so "did the
 * patient get their confirmation?" is answerable, and so a reminder cannot go
 * out twice.
 */
/**
 * Sends and records the attempt. Never throws: a failed email must not roll
 * back a paid, confirmed booking.
 *
 * Returns whether it actually went out, so callers that are reporting to a
 * user can say so honestly. Callers in the booking flow can keep ignoring it.
 */
export async function sendEmail(
  type: EmailType,
  email: OutgoingEmail,
  bookingId?: string
): Promise<boolean> {
  // Refuse before spending a send. An address that hard bounced or reported us
  // as spam will not accept mail, and continuing to try is what costs a sender
  // their access.
  if (await isSuppressed(email.to)) {
    await prisma.emailLog.create({
      data: {
        bookingId: bookingId ?? null,
        type,
        recipient: email.to,
        subject: email.subject,
        failedAt: new Date(),
        error: 'Address is suppressed after an earlier hard bounce or complaint.',
      },
    });
    logger.warn({ type, to: email.to }, 'Send skipped, address suppressed');
    return false;
  }

  const log = await prisma.emailLog.create({
    data: { bookingId: bookingId ?? null, type, recipient: email.to, subject: email.subject },
  });

  try {
    const { messageId } = await provider.send(email);
    await prisma.emailLog.update({
      where: { id: log.id },
      data: { sentAt: new Date(), providerMessageId: messageId },
    });
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown email failure';
    await prisma.emailLog.update({
      where: { id: log.id },
      data: { failedAt: new Date(), error: message },
    });
    // Recorded rather than thrown, and resendable from the admin panel.
    logger.error({ err: message, type, to: email.to }, 'Email send failed');
    return false;
  }
}

export async function alreadySent(bookingId: string, type: EmailType): Promise<boolean> {
  const count = await prisma.emailLog.count({
    where: { bookingId, type, sentAt: { not: null } },
  });
  return count > 0;
}

export const emailProviderName = provider.name;
