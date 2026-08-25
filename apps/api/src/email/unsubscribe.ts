/**
 * Unsubscribe.
 *
 * The guide form promises "unsubscribe at any time" and the consent wording we
 * store says the same, so the mechanism has to exist. In the UK, PECR requires
 * a working opt-out in every marketing message, and the promise was already
 * being made to people.
 *
 * The link carries an HMAC of the address rather than a database token: it is
 * stateless, cannot be enumerated by guessing ids, and survives a row being
 * deleted. It is signed with the same secret as the rest of the application.
 *
 * Unsubscribing is deliberately narrow. It turns off marketing only. Someone
 * who opts out still gets the confirmation, reminder and cancellation emails
 * for an appointment they have paid for, because those are not marketing and
 * withholding them would leave a patient not knowing when to attend.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import { config } from '../config';

const normalise = (email: string): string => email.trim().toLowerCase();

export function unsubscribeToken(email: string): string {
  return createHmac('sha256', config.JWT_SECRET)
    .update(`unsubscribe:${normalise(email)}`)
    .digest('base64url');
}

export function unsubscribeUrl(email: string): string {
  const params = new URLSearchParams({ email: normalise(email), token: unsubscribeToken(email) });
  return `${config.WEB_URL}/unsubscribe?${params.toString()}`;
}

/** Constant-time, so the endpoint cannot be used to probe for valid tokens. */
export function isValidUnsubscribeToken(email: string, token: string): boolean {
  const expected = Buffer.from(unsubscribeToken(email));
  const supplied = Buffer.from(token);
  if (expected.length !== supplied.length) return false;
  return timingSafeEqual(expected, supplied);
}
