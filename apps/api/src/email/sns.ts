/**
 * Amazon SNS message verification.
 *
 * SES reports bounces and complaints by POSTing to a public URL. Anyone can
 * POST to that URL, and acting on an unverified message would let a stranger
 * suppress any address they liked, which is a denial of service against the
 * clinic's own patients. So every message is checked against Amazon's
 * signature before it is looked at.
 *
 * Written against the documented format rather than pulled from a library:
 * the rules are short, and a dependency in the path of a public endpoint is
 * a dependency worth not having.
 */
import { createVerify, constants } from 'node:crypto';
import { logger } from '../logger';

export interface SnsMessage {
  Type: string;
  MessageId: string;
  TopicArn: string;
  Subject?: string;
  Message: string;
  Timestamp: string;
  SignatureVersion: string;
  Signature: string;
  SigningCertURL: string;
  SubscribeURL?: string;
  Token?: string;
}

/**
 * The fields that are signed, in the exact order Amazon signs them. Order is
 * part of the signature: reordering these silently breaks verification.
 */
const SIGNED_FIELDS: Record<string, readonly string[]> = {
  Notification: ['Message', 'MessageId', 'Subject', 'Timestamp', 'TopicArn', 'Type'],
  SubscriptionConfirmation: [
    'Message',
    'MessageId',
    'SubscribeURL',
    'Timestamp',
    'Token',
    'TopicArn',
    'Type',
  ],
  UnsubscribeConfirmation: [
    'Message',
    'MessageId',
    'SubscribeURL',
    'Timestamp',
    'Token',
    'TopicArn',
    'Type',
  ],
};

/**
 * Certificates are fetched over the network and cached. Without the cache a
 * burst of bounces becomes a burst of outbound requests.
 */
const certificateCache = new Map<string, string>();

/**
 * Only Amazon's own certificate host is acceptable.
 *
 * SigningCertURL arrives inside the very message we are trying to verify, so
 * an attacker controls it. Without this check they would simply point it at a
 * certificate of their own and sign whatever they wanted.
 */
function isAmazonCertificateUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  return (
    url.protocol === 'https:' &&
    /^sns\.[a-z0-9-]+\.amazonaws\.com$/.test(url.hostname) &&
    url.pathname.endsWith('.pem')
  );
}

async function fetchCertificate(url: string): Promise<string | null> {
  const cached = certificateCache.get(url);
  if (cached) return cached;

  const response = await fetch(url, { signal: AbortSignal.timeout(5_000) });
  if (!response.ok) return null;

  const pem = await response.text();
  certificateCache.set(url, pem);
  return pem;
}

/** The canonical string Amazon signed: key, newline, value, newline, in order. */
function stringToSign(message: SnsMessage): string {
  const fields = SIGNED_FIELDS[message.Type];
  if (!fields) return '';

  let result = '';
  for (const field of fields) {
    const value = (message as unknown as Record<string, string | undefined>)[field];
    // Absent optional fields are skipped entirely rather than signed as empty.
    if (value === undefined || value === null) continue;
    result += `${field}\n${value}\n`;
  }
  return result;
}

export async function verifySnsMessage(message: SnsMessage): Promise<boolean> {
  if (!SIGNED_FIELDS[message.Type]) return false;

  if (!isAmazonCertificateUrl(message.SigningCertURL)) {
    logger.warn({ url: message.SigningCertURL }, 'SNS message named a non-Amazon certificate host');
    return false;
  }

  const certificate = await fetchCertificate(message.SigningCertURL).catch(() => null);
  if (!certificate) return false;

  // SignatureVersion 1 is SHA1, 2 is SHA256. Amazon still sends 1 on some
  // topics, so both are accepted rather than assuming the newer one.
  const algorithm = message.SignatureVersion === '2' ? 'RSA-SHA256' : 'RSA-SHA1';

  try {
    const verifier = createVerify(algorithm);
    verifier.update(stringToSign(message), 'utf8');
    verifier.end();
    return verifier.verify(
      { key: certificate, padding: constants.RSA_PKCS1_PADDING },
      message.Signature,
      'base64'
    );
  } catch (error) {
    logger.warn({ err: error instanceof Error ? error.message : error }, 'SNS verification threw');
    return false;
  }
}
