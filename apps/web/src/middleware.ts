import { NextResponse, type NextRequest } from 'next/server';

const ACCESS_COOKIE = 'pmd_access';

/**
 * First of three enforcement points for access control.
 *
 * Middleware runs on the edge and cannot verify a JWT signature, so it only
 * checks that a token is present, enough to redirect a signed-out visitor to
 * the right login screen without a round trip. The token is actually verified
 * by the API on every request, and `requireSession` in each server component
 * turns a rejected token back into a redirect.
 *
 * Role routing is handled in the page rather than here, because the role lives
 * inside the signed token.
 */
export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  const isAdminArea = pathname.startsWith('/admin');
  const isPartnerArea = pathname.startsWith('/partner');
  if (!isAdminArea && !isPartnerArea) return NextResponse.next();

  // Login screens are the way in, never guard them.
  if (pathname === '/admin/login' || pathname === '/partner/login') return NextResponse.next();

  if (!request.cookies.get(ACCESS_COOKIE)?.value) {
    const area = isAdminArea ? 'admin' : 'partner';
    const login = new URL(`/${area}/login`, request.url);
    login.searchParams.set('next', `${pathname}${search}`);
    return NextResponse.redirect(login);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/partner/:path*'],
};
