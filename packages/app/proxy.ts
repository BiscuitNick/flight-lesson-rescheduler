/**
 * Next.js Proxy (formerly Middleware)
 * Handles authentication, authorization, and request routing
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  validateSession,
  injectUserHeaders,
  isProtectedRoute,
  isAuthRoute,
  getRoleBasedRedirect,
  type MiddlewareUserClaims,
} from '@/lib/auth/middleware';

/**
 * Dev user accounts matching seed data
 * Using fixed UUIDs for consistent dev experience
 */
const DEV_USERS = {
  instructor: {
    userId: '00000000-0000-0000-0000-000000000001',
    email: 'john.instructor@flightschool.com',
    name: 'John Smith',
    role: 'INSTRUCTOR' as const,
    trainingLevel: 'INSTRUMENT_RATED' as const,
  },
  student: {
    userId: '00000000-0000-0000-0000-000000000002',
    email: 'alice.student@example.com',
    name: 'Alice Brown',
    role: 'STUDENT' as const,
    trainingLevel: 'STUDENT_PILOT' as const,
  },
  admin: {
    userId: '00000000-0000-0000-0000-000000000003',
    email: 'admin@flightschool.com',
    name: 'Admin User',
    role: 'ADMIN' as const,
    trainingLevel: undefined,
  },
};

/**
 * Get dev user based on route and cookies
 */
function getDevUserForRoute(request: NextRequest): MiddlewareUserClaims {
  const { pathname } = request.nextUrl;

  // Check for dev_user cookie first
  const devUserCookie = request.cookies.get('dev_user')?.value;
  if (devUserCookie && devUserCookie in DEV_USERS) {
    return DEV_USERS[devUserCookie as keyof typeof DEV_USERS];
  }

  // Fall back to route-based detection
  if (pathname.startsWith('/instructor')) {
    return DEV_USERS.instructor;
  }

  if (pathname.startsWith('/student') || pathname.startsWith('/dashboard/student')) {
    return DEV_USERS.student;
  }

  if (pathname.startsWith('/admin') || pathname.startsWith('/dashboard/admin')) {
    return DEV_USERS.admin;
  }

  // Default to instructor for API routes and other protected routes
  return DEV_USERS.instructor;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Handle dev mode
  const isDevMode = process.env.NEXT_PUBLIC_DEV_MODE === 'true';
  if (isDevMode) {
    // Inject dev user headers for protected routes AND API routes
    if (isProtectedRoute(pathname) || pathname.startsWith('/api/trpc')) {
      const devUser = getDevUserForRoute(request);
      const response = NextResponse.next();
      return injectUserHeaders(response, devUser);
    }
    return NextResponse.next();
  }

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
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
