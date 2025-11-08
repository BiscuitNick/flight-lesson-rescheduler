/**
 * Development Authentication Bypass
 * Allows testing without AWS Amplify configured
 */

import type { UserRole, TrainingLevel } from '@prisma/client';
import type { AuthenticatedUser } from './session';

/**
 * Test accounts available in dev mode
 * Using fixed UUIDs matching seed data
 */
export const DEV_TEST_ACCOUNTS = {
  student: {
    id: '00000000-0000-0000-0000-000000000002',
    email: 'alice.student@example.com',
    name: 'Alice Brown',
    role: 'STUDENT' as UserRole,
    trainingLevel: 'STUDENT_PILOT' as TrainingLevel,
  },
  privatePilot: {
    id: '00000000-0000-0000-0000-000000000005',
    email: 'bob.student@example.com',
    name: 'Bob Wilson',
    role: 'STUDENT' as UserRole,
    trainingLevel: 'PRIVATE_PILOT' as TrainingLevel,
  },
  instrumentStudent: {
    id: '00000000-0000-0000-0000-000000000006',
    email: 'carol.student@example.com',
    name: 'Carol Davis',
    role: 'STUDENT' as UserRole,
    trainingLevel: 'INSTRUMENT_RATED' as TrainingLevel,
  },
  instructor: {
    id: '00000000-0000-0000-0000-000000000001',
    email: 'john.instructor@flightschool.com',
    name: 'John Smith',
    role: 'INSTRUCTOR' as UserRole,
    trainingLevel: 'INSTRUMENT_RATED' as TrainingLevel,
  },
  instructor2: {
    id: '00000000-0000-0000-0000-000000000004',
    email: 'sarah.instructor@flightschool.com',
    name: 'Sarah Johnson',
    role: 'INSTRUCTOR' as UserRole,
    trainingLevel: 'INSTRUMENT_RATED' as TrainingLevel,
  },
  admin: {
    id: '00000000-0000-0000-0000-000000000003',
    email: 'admin@flightschool.com',
    name: 'Admin User',
    role: 'ADMIN' as UserRole,
    trainingLevel: undefined,
  },
};

/**
 * Check if dev mode is enabled
 */
export function isDevMode(): boolean {
  return process.env.DEV_MODE === 'true' || process.env.NEXT_PUBLIC_DEV_MODE === 'true';
}

/**
 * Get current dev user from cookie
 */
export function getDevUser(): AuthenticatedUser | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const cookies = document.cookie.split(';');
  const devUserCookie = cookies.find((c) => c.trim().startsWith('dev_user='));

  if (!devUserCookie) {
    // Default to student account
    return DEV_TEST_ACCOUNTS.student;
  }

  const userKey = devUserCookie.split('=')[1] as keyof typeof DEV_TEST_ACCOUNTS;
  return DEV_TEST_ACCOUNTS[userKey] || DEV_TEST_ACCOUNTS.student;
}

/**
 * Set dev user via cookie
 */
export function setDevUser(userKey: keyof typeof DEV_TEST_ACCOUNTS): void {
  if (typeof window === 'undefined') {
    return;
  }

  document.cookie = `dev_user=${userKey}; path=/; max-age=86400`; // 24 hours
}

/**
 * Clear dev user cookie (logout)
 */
export function clearDevUser(): void {
  if (typeof window === 'undefined') {
    return;
  }

  document.cookie = 'dev_user=; path=/; max-age=0';
}

/**
 * Get all available dev accounts for selection
 */
export function getDevAccounts() {
  return Object.entries(DEV_TEST_ACCOUNTS).map(([key, user]) => ({
    key,
    ...user,
  }));
}
