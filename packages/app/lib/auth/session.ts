/**
 * Authentication session utilities
 * Handles user session management, JWT decoding, and user claims
 */

import { fetchAuthSession, getCurrentUser } from 'aws-amplify/auth';
import type { UserRole, TrainingLevel } from '@prisma/client';

/**
 * User claims extracted from Cognito JWT token
 */
export interface UserClaims {
  sub: string; // Cognito user ID
  email: string;
  name: string;
  role: UserRole;
  trainingLevel?: TrainingLevel;
  'custom:role'?: string;
  'custom:trainingLevel'?: string;
}

/**
 * Authenticated user information
 */
export interface AuthenticatedUser {
  id: string; // Cognito sub (user ID)
  email: string;
  name: string;
  role: UserRole;
  trainingLevel?: TrainingLevel;
}

/**
 * Get the current authenticated user's session and claims
 * @throws Error if user is not authenticated or session is invalid
 */
export async function getAuthenticatedUser(): Promise<AuthenticatedUser> {
  try {
    const [session, user] = await Promise.all([
      fetchAuthSession(),
      getCurrentUser(),
    ]);

    if (!session.tokens?.idToken) {
      throw new Error('No valid session token');
    }

    const claims = session.tokens.idToken.payload as unknown as UserClaims;

    // Extract role from custom attribute or fallback to default
    const role = (claims['custom:role'] as UserRole) || 'STUDENT';

    // Extract training level from custom attribute if present
    const trainingLevel = claims['custom:trainingLevel'] as
      | TrainingLevel
      | undefined;

    return {
      id: user.userId,
      email: claims.email,
      name: claims.name || user.username,
      role,
      trainingLevel,
    };
  } catch (error) {
    console.error('Failed to get authenticated user:', error);
    throw new Error('User is not authenticated');
  }
}

/**
 * Get the current user's JWT access token
 * @returns Access token string or null if not authenticated
 */
export async function getAccessToken(): Promise<string | null> {
  try {
    const session = await fetchAuthSession();
    return session.tokens?.accessToken?.toString() || null;
  } catch (error) {
    console.error('Failed to get access token:', error);
    return null;
  }
}

/**
 * Get the current user's JWT ID token
 * @returns ID token string or null if not authenticated
 */
export async function getIdToken(): Promise<string | null> {
  try {
    const session = await fetchAuthSession();
    return session.tokens?.idToken?.toString() || null;
  } catch (error) {
    console.error('Failed to get ID token:', error);
    return null;
  }
}

/**
 * Check if the user is authenticated
 * @returns true if user has a valid session
 */
export async function isAuthenticated(): Promise<boolean> {
  try {
    const session = await fetchAuthSession();
    return !!session.tokens?.accessToken;
  } catch {
    return false;
  }
}

/**
 * Extract user claims from JWT token payload
 */
export function extractUserClaims(tokenPayload: Record<string, unknown>): {
  role: UserRole;
  trainingLevel?: TrainingLevel;
} {
  const role = (tokenPayload['custom:role'] as UserRole) || 'STUDENT';
  const trainingLevel = tokenPayload['custom:trainingLevel'] as
    | TrainingLevel
    | undefined;

  return { role, trainingLevel };
}
