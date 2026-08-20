import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import type { Permission, SessionUser, UserRole } from '@peptide/shared';
import { can } from '@peptide/shared';
import { apiFetch, ACCESS_COOKIE } from '@/lib/api/server';

export { ACCESS_COOKIE as SESSION_COOKIE };

interface MeResponse {
  id: string;
  name: string;
  email: string;
  role: string;
  partnerId: string | null;
  doctorId: string | null;
}

/**
 * The signed-in staff user, resolved by asking the API to verify the token.
 *
 * The middleware only checks that a cookie exists, it runs on the edge and
 * cannot verify a signature. This is where the token is actually validated, so
 * a forged or expired cookie gets a signed-out user rather than access.
 *
 * `cache` dedupes it across a single render: a page, its layout and its shell
 * all ask for the session and only one request goes out.
 */
export const getSession = cache(async (): Promise<SessionUser | null> => {
  const token = cookies().get(ACCESS_COOKIE)?.value;
  if (!token) return null;

  const result = await apiFetch<MeResponse>('/api/auth/me');
  if (!result.success || !result.data) return null;

  return {
    id: result.data.id,
    name: result.data.name,
    email: result.data.email,
    role: result.data.role as UserRole,
    partnerId: result.data.partnerId,
  };
});

/** Require any signed-in staff user, or bounce to the right login screen. */
export async function requireSession(
  area: 'admin' | 'partner',
  path: string
): Promise<SessionUser> {
  const session = await getSession();
  if (!session) redirect(`/${area}/login?next=${encodeURIComponent(path)}`);

  if (area === 'admin' && session.role === 'partner') redirect('/partner/bookings');
  if (area === 'partner' && session.role !== 'partner') redirect('/admin');

  return session;
}

/**
 * Require a permission. The API enforces the same rules independently, this
 * exists so a role lands on an explanatory screen instead of a bare 403 body.
 */
export function requirePermission(session: SessionUser, permission: Permission): void {
  if (!can(session, permission)) redirect('/admin/no-access');
}

/** The partner a portal user is pinned to. Never taken from the URL. */
export function requirePartnerId(session: SessionUser): string {
  if (session.role !== 'partner' || !session.partnerId) redirect('/partner/login');
  return session.partnerId;
}
