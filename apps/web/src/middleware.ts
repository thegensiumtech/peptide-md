import { NextResponse, type NextRequest } from 'next/server';
import { GUIDE_DOWNLOAD_ENABLED } from '@peptide/shared';

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

  // The guide PDF sits in public/, which would otherwise serve it to anyone
  // with the URL while it is switched off for legal review. Compared on the
  // decoded, lower-cased path, because the static server also answers
  // encoded spellings such as %2Epdf that an exact match would let through.
  if (!GUIDE_DOWNLOAD_ENABLED && isGuidePdf(pathname)) {
    return new NextResponse('Not found', { status: 404 });
  }

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
  // Everything except Next's own build assets. The guide check above must see
  // encoded spellings of /guides too (e.g. /%67uides/...), which a
  // '/guides/:path*' matcher would never route here. Every other path falls
  // straight through to the admin/partner checks, unchanged.
  matcher: ['/((?!_next/static|_next/image).*)'],
};

/** Any PDF under /guides/, however the path is encoded or cased. */
function isGuidePdf(pathname: string): boolean {
  let decoded = pathname;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    // Malformed encoding: judge the raw path instead.
  }
  const path = decoded.toLowerCase();
  return path.startsWith('/guides/') && path.replace(/\/+$/, '').endsWith('.pdf');
}
