import { NextResponse } from 'next/server';

const PUBLIC_PATHS = new Set([
  '/',
  '/docs',
  '/login',
  '/register',
  '/forgot-password',
  '/opt',
  '/reset-password',
  '/invite/accept',
  '/admin/login',
  '/settings-access',
]);

const ORG_ADMIN_PATHS = [
  '/settings/general',
  '/settings/api-keys',
  '/settings/members',
  '/settings/webhooks',
  '/settings/integrations',
];

const matchesPath = (pathname, path) => pathname === path || pathname.startsWith(`${path}/`);

export function middleware(request) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.has(pathname)) return NextResponse.next();

  const isAuthenticated = request.cookies.get('ridgeway_auth')?.value === '1';
  if (!isAuthenticated) return NextResponse.redirect(new URL('/login', request.url));

  const role = request.cookies.get('ridgeway_role')?.value;
  const isSuperAdmin = role === 'super_admin';

  if (!isSuperAdmin && request.cookies.get('ridgeway_setup')?.value === '0' && !matchesPath(pathname, '/setup')) {
    return NextResponse.redirect(new URL('/setup', request.url));
  }

  const requiresSuperAdmin = matchesPath(pathname, '/admin');
  const requiresOrgAdmin = ORG_ADMIN_PATHS.some((path) => matchesPath(pathname, path));
  if ((requiresSuperAdmin && !isSuperAdmin) || (requiresOrgAdmin && !['org_admin', 'super_admin'].includes(role))) {
    return NextResponse.redirect(new URL('/forbidden', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
