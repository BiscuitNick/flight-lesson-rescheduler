/**
 * tRPC Context Tests
 * Unit tests for authentication context and RBAC helpers
 */

import { describe, it, expect } from 'vitest';
import {
  assertAuthenticated,
  assertRole,
  assertAdmin,
  assertInstructor,
  assertOwnership,
  type AuthenticatedUser,
} from '../context';
import { TRPCError } from '@trpc/server';

describe('tRPC Context Helpers', () => {
  const studentUser: AuthenticatedUser = {
    id: 'user-1',
    email: 'student@test.com',
    name: 'Student User',
    role: 'STUDENT',
    trainingLevel: 'STUDENT_PILOT',
  };

  const instructorUser: AuthenticatedUser = {
    id: 'user-2',
    email: 'instructor@test.com',
    name: 'Instructor User',
    role: 'INSTRUCTOR',
  };

  const adminUser: AuthenticatedUser = {
    id: 'user-3',
    email: 'admin@test.com',
    name: 'Admin User',
    role: 'ADMIN',
  };

  describe('assertAuthenticated', () => {
    it('should pass for authenticated user', () => {
      expect(() => assertAuthenticated(studentUser)).not.toThrow();
    });

    it('should throw UNAUTHORIZED for null user', () => {
      expect(() => assertAuthenticated(null)).toThrow(TRPCError);
      expect(() => assertAuthenticated(null)).toThrow(/must be logged in/);
    });
  });

  describe('assertRole', () => {
    it('should pass when user has required role', () => {
      expect(() => assertRole(studentUser, ['STUDENT'])).not.toThrow();
      expect(() => assertRole(instructorUser, ['INSTRUCTOR'])).not.toThrow();
      expect(() => assertRole(adminUser, ['ADMIN'])).not.toThrow();
    });

    it('should pass when user has one of multiple allowed roles', () => {
      expect(() =>
        assertRole(instructorUser, ['INSTRUCTOR', 'ADMIN']),
      ).not.toThrow();
      expect(() => assertRole(adminUser, ['INSTRUCTOR', 'ADMIN'])).not.toThrow();
    });

    it('should throw FORBIDDEN when user lacks required role', () => {
      expect(() => assertRole(studentUser, ['ADMIN'])).toThrow(TRPCError);
      expect(() => assertRole(studentUser, ['ADMIN'])).toThrow(/Access denied/);
    });

    it('should throw UNAUTHORIZED for null user', () => {
      expect(() => assertRole(null, ['STUDENT'])).toThrow(TRPCError);
    });
  });

  describe('assertAdmin', () => {
    it('should pass for admin user', () => {
      expect(() => assertAdmin(adminUser)).not.toThrow();
    });

    it('should throw for non-admin users', () => {
      expect(() => assertAdmin(studentUser)).toThrow(TRPCError);
      expect(() => assertAdmin(instructorUser)).toThrow(TRPCError);
    });
  });

  describe('assertInstructor', () => {
    it('should pass for instructor user', () => {
      expect(() => assertInstructor(instructorUser)).not.toThrow();
    });

    it('should pass for admin user', () => {
      expect(() => assertInstructor(adminUser)).not.toThrow();
    });

    it('should throw for student user', () => {
      expect(() => assertInstructor(studentUser)).toThrow(TRPCError);
    });
  });

  describe('assertOwnership', () => {
    it('should pass when user owns the resource', () => {
      expect(() => assertOwnership(studentUser, 'user-1')).not.toThrow();
    });

    it('should throw when user does not own the resource', () => {
      expect(() => assertOwnership(studentUser, 'user-2')).toThrow(TRPCError);
      expect(() => assertOwnership(studentUser, 'user-2')).toThrow(
        /do not have permission/,
      );
    });

    it('should always pass for admin users', () => {
      expect(() => assertOwnership(adminUser, 'user-1')).not.toThrow();
      expect(() => assertOwnership(adminUser, 'user-2')).not.toThrow();
      expect(() => assertOwnership(adminUser, 'any-id')).not.toThrow();
    });

    it('should throw UNAUTHORIZED for null user', () => {
      expect(() => assertOwnership(null, 'user-1')).toThrow(TRPCError);
    });
  });
});
