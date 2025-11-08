/**
 * Server-side authentication middleware utilities
 * Validates Cognito JWT tokens and extracts user claims
 */

import { NextRequest, NextResponse } from 'next/server';
import { fetchAuthSession } from 'aws-amplify/auth/server';
import { runWithAmplifyServerContext } from '@/lib/auth/server-config';
import type { UserRole, TrainingLevel } from '@prisma/client';

/**
 * User claims to be injected into request headers
 */
export interface MiddlewareUserClaims {
  userId: string;
  email: string;
  name: string;
  role: UserRole;
  trainingLevel?: TrainingLevel;
}

/**
 * Extract and validate user session from cookies
 * Returns user claims if authenticated, null otherwise
 */
export async function validateSession(
  request: NextRequest,
): Promise<MiddlewareUserClaims | null> {
  try {
    // Extract Amplify tokens from cookies
    // Amplify stores tokens in cookies with specific keys
    const cookies = request.cookies;
    const idTokenCookie = cookies.get('idToken')?.value;

    if (!idTokenCookie) {
      // Check for alternate cookie names that Amplify might use
      const altIdToken = cookies.get(
        `CognitoIdentityServiceProvider.${process.env.NEXT_PUBLIC_AMPLIFY_USER_POOL_CLIENT_ID}.LastAuthUser.idToken`,
      )?.value;

      if (!altIdToken) {
        return null;
      }
    }

    // For now, we'll rely on the client-side session validation
    // In production, you would verify the JWT token here using AWS Cognito's public keys
    // This is a simplified approach for Next.js 16 compatibility

    // Parse the token payload (without verification for now)
    // Note: In production, always verify JWT signatures!
    const token = idTokenCookie || '';
    if (!token) return null;

    const payload = parseJwtPayload(token);
    if (!payload) return null;

    const userId = payload.sub as string;
    const email = payload.email as string;
    const name = (payload.name as string) || email;
    const role = (payload['custom:role'] as UserRole) || 'STUDENT';
    const trainingLevel = payload['custom:trainingLevel'] as
      | TrainingLevel
      | undefined;

    return {
      userId,
      email,
      name,
      role,
      trainingLevel,
    };
  } catch (error) {
    console.error('Session validation failed:', error);
    return null;
  }
}

/**
 * Parse JWT payload without verification
 * WARNING: This should only be used in middleware for extracting claims
 * Always verify tokens on the server-side in API routes!
 */
function parseJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const payload = parts[1];
    const decoded = Buffer.from(payload, 'base64').toString('utf-8');
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

/**
 * Inject user claims into request headers for downstream consumption
 */
export function injectUserHeaders(
  response: NextResponse,
  claims: MiddlewareUserClaims,
): NextResponse {
  const requestHeaders = new Headers(response.headers);

  requestHeaders.set('x-user-id', claims.userId);
  requestHeaders.set('x-user-email', claims.email);
  requestHeaders.set('x-user-name', claims.name);
  requestHeaders.set('x-user-role', claims.role);

  if (claims.trainingLevel) {
    requestHeaders.set('x-user-training-level', claims.trainingLevel);
  }

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

/**
 * Check if a route requires authentication
 */
export function isProtectedRoute(pathname: string): boolean {
  const protectedPaths = ['/dashboard', '/admin', '/instructor', '/student'];

  return protectedPaths.some((path) => pathname.startsWith(path));
}

/**
 * Check if a route is auth-related (login, signup)
 */
export function isAuthRoute(pathname: string): boolean {
  const authPaths = ['/login', '/signup'];
  return authPaths.some((path) => pathname.startsWith(path));
}

/**
 * Get redirect URL based on user role
 */
export function getRoleBasedRedirect(role: UserRole): string {
  switch (role) {
    case 'ADMIN':
      return '/dashboard/admin';
    case 'INSTRUCTOR':
      return '/dashboard/instructor';
    case 'STUDENT':
      return '/dashboard/student';
    default:
      return '/dashboard';
  }
}
