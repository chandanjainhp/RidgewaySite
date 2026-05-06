import { NextResponse } from 'next/server';

/**
 * Next.js Edge Middleware — Route Guard
 *
 * Protected routes: /investigate, /briefing, /incident
 * Auth routes:       /login, /register
 *
 * Auth state is carried by the `ridgeway_auth` cookie which is set
 * client-side after a successful login (not httpOnly, so Edge can read it).
 */

// Routes that require authentication
const PROTECTED_PREFIXES = ['/investigate', '/briefing', '/incident', '/settings', '/admin', '/dashboard'];

// Role requirements
const ADMIN_PATHS = ['/admin'];
const SETTINGS_PATHS = ['/settings'];

// Routes that bypass authentication checks
const PUBLIC_PATHS = ['/', '/login', '/register'];

// Routes that should redirect to /investigate if already authenticated
const AUTH_ROUTES = ['/login', '/register'];

export function middleware(request) {
  const { pathname } = request.nextUrl;
  const authCookie = request.cookies.get('ridgeway_auth');
  const isAuthenticated = authCookie?.value === '1';
  const isPublicPath = PUBLIC_PATHS.some((path) =>
    path === '/' ? pathname === '/' : pathname.startsWith(path)
  );

  if (isPublicPath && !isAuthenticated) {
    return NextResponse.next();
  }

  // Redirect unauthenticated users away from protected routes
  const isProtected = PROTECTED_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix)
  );

  if (isProtected && !isAuthenticated) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('from', encodeURIComponent(pathname));
    return NextResponse.redirect(loginUrl);
  }

  // Role checks for authenticated users
  if (isAuthenticated) {
    const roleCookie = request.cookies.get('ridgeway_role');
    const userRole = roleCookie?.value;

    const isAdminPath = ADMIN_PATHS.some((path) => pathname.startsWith(path));
    if (isAdminPath && userRole !== 'super_admin') {
      return NextResponse.redirect(new URL('/forbidden', request.url));
    }

    const isSettingsPath = SETTINGS_PATHS.some((path) => pathname.startsWith(path));
    if (isSettingsPath && !['super_admin', 'org_admin'].includes(userRole)) {
      return NextResponse.redirect(new URL('/forbidden', request.url));
    }
  }

  // Redirect already-authenticated users away from auth routes and landing page
  const isAuthRoute = AUTH_ROUTES.some((route) => pathname.startsWith(route)) || pathname === '/';

  if (isAuthRoute && isAuthenticated) {
    const from = request.nextUrl.searchParams.get('from');
    const redirectTo = from ? decodeURIComponent(from) : '/investigate';
    return NextResponse.redirect(new URL(redirectTo, request.url));
  }

  return NextResponse.next();
}

export const config = {
  // Run middleware on all routes except static assets, images, and API routes
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/).*)',
  ],
};
