/**
 * The live API client.
 *
 * The rest of the site reads from static fixtures in lib/data/client.ts. These
 * screens do not: a patient moving or cancelling an appointment has to be
 * looking at the real diary, so everything under /manage talks to the Express
 * API over the network.
 *
 * Every call comes back in the same envelope, including the failures, so screens
 * branch on one shape and never on a thrown error.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export type ApiResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string };

/** A failure the UI can show as-is. Never carries internal detail. */
export function failure(error: string, code?: string): ApiResult<never> {
  return { success: false, error, code };
}

interface ApiEnvelope<T> {
  success: boolean;
  data: T | null;
  error: string | null;
  code?: string;
}

/**
 * All manage endpoints are POST, reads included — an email address in a query
 * string ends up in server logs and referrer headers, which is the wrong place
 * for it on a medical booking.
 *
 * `token` is the bearer from the access-code check. Omitted only by the two
 * endpoints that exist to obtain one.
 */
export async function postJson<T>(
  path: string,
  body: unknown,
  token?: string
): Promise<ApiResult<T>> {
  let response: Response;

  try {
    response = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
      cache: 'no-store',
    });
  } catch {
    // Unreachable API, offline browser, blocked by an extension. The patient
    // needs a next step, not a stack trace.
    return failure(
      'We could not reach the booking service. Check your connection and try again.',
      'NETWORK'
    );
  }

  // A dead or missing token is not an error to show — it means the patient has
  // to confirm their address again, and the screens send them back to do it.
  if (response.status === 401) {
    return failure('Your session has expired. Confirm your email again.', 'SESSION_EXPIRED');
  }

  // 429 is the one status worth naming: the limiter is deliberately tight here
  // and a patient retrying should be told to wait rather than to try harder.
  if (response.status === 429) {
    const throttled = (await response.json().catch(() => null)) as ApiEnvelope<never> | null;
    return failure(
      throttled?.error ?? 'Too many attempts. Wait a minute and try again.',
      'RATE_LIMITED'
    );
  }

  const envelope = (await response.json().catch(() => null)) as ApiEnvelope<T> | null;

  if (!envelope) {
    return failure('The booking service returned something we could not read.', 'BAD_RESPONSE');
  }

  if (!response.ok || !envelope.success || envelope.data === null) {
    return failure(envelope.error ?? 'Something went wrong. Please try again.', envelope.code);
  }

  return { success: true, data: envelope.data };
}
