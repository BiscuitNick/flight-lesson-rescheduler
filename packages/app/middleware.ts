/**
 * Next.js Middleware
 * Handles authentication, authorization, and request routing
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  validateSession,
  injectUserHeaders,
  isProtectedRoute,
  isAuthRoute,
  getRoleBasedRedirect,
} from '@/lib/auth/middleware';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Validate user session
  const userClaims = await validateSession(request);

  // Handle protected routes
  if (isProtectedRoute(pathname)) {
    if (!userClaims) {
      // Redirect to login if not authenticated
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Check role-based access for specific routes
    if (pathname.startsWith('/dashboard/admin') && userClaims.role !== 'ADMIN') {
      // Redirect to role-appropriate dashboard
      const redirectUrl = new URL(
        getRoleBasedRedirect(userClaims.role),
        request.url,
      );
      return NextResponse.redirect(redirectUrl);
    }

    if (
      pathname.startsWith('/dashboard/instructor') &&
      userClaims.role !== 'INSTRUCTOR' &&
      userClaims.role !== 'ADMIN'
    ) {
      const redirectUrl = new URL(
        getRoleBasedRedirect(userClaims.role),
        request.url,
      );
      return NextResponse.redirect(redirectUrl);
    }

    // Inject user claims into headers for downstream use
    const response = NextResponse.next();
    return injectUserHeaders(response, userClaims);
  }

  // Redirect authenticated users away from auth pages
  if (isAuthRoute(pathname) && userClaims) {
    const dashboardUrl = new URL(
      getRoleBasedRedirect(userClaims.role),
      request.url,
    );
    return NextResponse.redirect(dashboardUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     * - api routes (handled separately)
     */
    '/((?!_next/static|_next/image|favicon.ico|api).*)',
  ],
};
