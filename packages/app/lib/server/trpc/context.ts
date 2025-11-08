/**
 * tRPC Context
 * Provides authenticated user information and database access to all procedures
 */

import { type NextRequest } from 'next/server';
import { prisma } from '@/lib/server/db/prisma';
import type { UserRole, TrainingLevel } from '@prisma/client';
import { TRPCError } from '@trpc/server';

/**
 * Authenticated user information from middleware headers
 */
export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  trainingLevel?: TrainingLevel;
}

/**
 * tRPC context shape
 */
export interface Context {
  prisma: typeof prisma;
  user: AuthenticatedUser | null;
}

/**
 * Options for creating tRPC context
 */
interface CreateContextOptions {
  req: NextRequest;
}

/**
 * Extract user from request headers (injected by middleware)
 */
function getUserFromHeaders(req: NextRequest): AuthenticatedUser | null {
  const userId = req.headers.get('x-user-id');
  const email = req.headers.get('x-user-email');
  const name = req.headers.get('x-user-name');
  const role = req.headers.get('x-user-role') as UserRole | null;
  const trainingLevel = req.headers.get('x-user-training-level') as
    | TrainingLevel
    | undefined;

  if (!userId || !email || !name || !role) {
    return null;
  }

  return {
    id: userId,
    email,
    name,
    role,
    trainingLevel,
  };
}

/**
 * Create tRPC context
 * Called for each request
 */
export function createTRPCContext(opts: CreateContextOptions): Context {
  const user = getUserFromHeaders(opts.req);

  return {
    prisma,
    user,
  };
}

/**
 * Assert that user is authenticated
 * @throws TRPCError with UNAUTHORIZED code if not authenticated
 */
export function assertAuthenticated(
  user: AuthenticatedUser | null,
): asserts user is AuthenticatedUser {
  if (!user) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'You must be logged in to perform this action',
    });
  }
}

/**
 * Assert that user has one of the required roles
 * @throws TRPCError with FORBIDDEN code if user doesn't have required role
 */
export function assertRole(
  user: AuthenticatedUser | null,
  roles: UserRole[],
): asserts user is AuthenticatedUser {
  assertAuthenticated(user);

  if (!roles.includes(user.role)) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: `Access denied. Required role: ${roles.join(' or ')}`,
    });
  }
}

/**
 * Assert that user is an admin
 * @throws TRPCError with FORBIDDEN code if user is not an admin
 */
export function assertAdmin(
  user: AuthenticatedUser | null,
): asserts user is AuthenticatedUser {
  assertRole(user, ['ADMIN']);
}

/**
 * Assert that user is an instructor or admin
 * @throws TRPCError with FORBIDDEN code if user is not an instructor or admin
 */
export function assertInstructor(
  user: AuthenticatedUser | null,
): asserts user is AuthenticatedUser {
  assertRole(user, ['INSTRUCTOR', 'ADMIN']);
}

/**
 * Check if user owns a resource
 * Useful for allowing users to access their own data
 */
export function assertOwnership(
  user: AuthenticatedUser | null,
  resourceUserId: string,
): asserts user is AuthenticatedUser {
  assertAuthenticated(user);

  // Admins can access everything
  if (user.role === 'ADMIN') {
    return;
  }

  if (user.id !== resourceUserId) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'You do not have permission to access this resource',
    });
  }
}
