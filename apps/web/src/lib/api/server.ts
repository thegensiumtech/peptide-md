import { cookies } from 'next/headers';

/**
 * Server-side API client.
 *
 * Used by server components and server actions. It forwards the staff access
 * token from the httpOnly cookie, so the browser never holds a JWT it could
 * leak through script, the cookie goes out with the request and the token
 * never reaches client JavaScript.
 *
 * The browser-facing client for patient self-service is lib/api/client.ts.
 */
const API_BASE = process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export const ACCESS_COOKIE = 'pmd_access';
export const REFRESH_COOKIE = 'pmd_refresh';

export interface ServerResult<T> {
  success: boolean;
  data: T | null;
  error: string | null;
  code?: string;
  meta?: { total: number; page: number; limit: number };
  status: number;
}

interface Options {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  /** Send the signed-in staff token. Off for public endpoints. */
  authenticated?: boolean;
  /** Seconds to cache. Anything reflecting live diary state stays uncached. */
  revalidate?: number;
}

export async function apiFetch<T>(path: string, options: Options = {}): Promise<ServerResult<T>> {
  const { method = 'GET', body, authenticated = true, revalidate } = options;

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  if (authenticated) {
    const token = cookies().get(ACCESS_COOKIE)?.value;
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      ...(revalidate === undefined ? { cache: 'no-store' } : { next: { revalidate } }),
    });
  } catch {
    return {
      success: false,
      data: null,
      error: 'We could not reach the booking service. Try again in a moment.',
      code: 'NETWORK',
      status: 0,
    };
  }

  const envelope = (await response.json().catch(() => null)) as {
    success?: boolean;
    data?: T;
    error?: string;
    code?: string;
    meta?: { total: number; page: number; limit: number };
  } | null;

  if (!envelope) {
    return {
      success: false,
      data: null,
      error: 'The booking service returned something we could not read.',
      code: 'BAD_RESPONSE',
      status: response.status,
    };
  }

  return {
    success: Boolean(envelope.success) && response.ok,
    data: envelope.data ?? null,
    error: envelope.error ?? null,
    code: envelope.code,
    meta: envelope.meta,
    status: response.status,
  };
}

/** Query string builder that drops empty values rather than sending `?x=`. */
export function query(params: Record<string, string | number | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value));
  }
  const result = search.toString();
  return result ? `?${result}` : '';
}
