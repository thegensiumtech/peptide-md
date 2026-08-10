'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ACCESS_COOKIE, REFRESH_COOKIE } from '@/lib/api/server';

const API_BASE =
  process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export interface SignInState {
  error: string | null;
}

/** FormData values can be files; only accept text for these fields. */
function readField(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === 'string' ? value : '';
}

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
};

/**
 * Sign in against the API.
 *
 * Credentials are checked by the API with bcrypt and a JWT comes back. The
 * token is stored httpOnly so client JavaScript can never read it, and the
 * area check keeps a partner out of the admin door and vice versa.
 */
async function signIn(
  area: 'admin' | 'partner',
  _prev: SignInState,
  formData: FormData
): Promise<SignInState> {
  const email = readField(formData, 'email').trim();
  const password = readField(formData, 'password');
  const next = readField(formData, 'next');

  if (!email) return { error: 'Enter your email address.' };
  if (!password) return { error: 'Enter your password.' };

  let response: Response;
  try {
    response = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      cache: 'no-store',
    });
  } catch {
    return { error: 'We could not reach the sign-in service. Try again in a moment.' };
  }

  const body = (await response.json().catch(() => null)) as {
    success?: boolean;
    error?: string;
    data?: { accessToken: string; user: { role: string } };
  } | null;

  if (response.status === 429) {
    return { error: body?.error ?? 'Too many attempts. Try again in a few minutes.' };
  }

  if (!response.ok || !body?.success || !body.data) {
    return { error: body?.error ?? 'That email and password do not match.' };
  }

  const role = body.data.user.role;

  if (area === 'admin' && role === 'partner') {
    return { error: 'That is a partner account. Sign in at the partner portal instead.' };
  }
  if (area === 'partner' && role !== 'partner') {
    return { error: 'That is a Peptides MD account. Sign in at the admin panel instead.' };
  }

  cookies().set(ACCESS_COOKIE, body.data.accessToken, {
    ...cookieOptions,
    maxAge: 8 * 60 * 60,
  });

  // The API also sets its own refresh cookie, but that is scoped to the API
  // host. Mirror it here so a Next server action can refresh too.
  const refresh = response.headers
    .getSetCookie?.()
    ?.find((c) => c.startsWith(`${REFRESH_COOKIE}=`))
    ?.split(';')[0]
    ?.split('=')[1];
  if (refresh) {
    cookies().set(REFRESH_COOKIE, refresh, { ...cookieOptions, maxAge: 30 * 24 * 60 * 60 });
  }

  const fallback = role === 'partner' ? '/partner/bookings' : '/admin';
  // Only accept an in-app destination, never an absolute URL from the query.
  const destination = next.startsWith('/') && !next.startsWith('//') ? next : fallback;
  redirect(destination);
}

export async function signInAdmin(prev: SignInState, formData: FormData) {
  return signIn('admin', prev, formData);
}

export async function signInPartner(prev: SignInState, formData: FormData) {
  return signIn('partner', prev, formData);
}

export async function signOut() {
  const token = cookies().get(ACCESS_COOKIE)?.value;

  // Revoke server-side so the refresh token cannot be reused, then clear
  // locally regardless of whether that call succeeded.
  if (token) {
    await fetch(`${API_BASE}/api/auth/logout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    }).catch(() => undefined);
  }

  const wasPartner = cookies().get('pmd_area')?.value === 'partner';
  cookies().delete(ACCESS_COOKIE);
  cookies().delete(REFRESH_COOKIE);
  cookies().delete('pmd_area');

  redirect(wasPartner ? '/partner/login' : '/admin/login');
}
