/**
 * Bookings Service Tests
 * Unit tests for booking business logic with RBAC
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TRPCError } from '@trpc/server';
import {
  listBookings,
  getBooking,
  createBooking,
  updateBooking,
  updateBookingStatus,
  deleteBooking,
} from '../bookings.service';

// Mock Prisma client
vi.mock('@/lib/server/db/prisma', () => ({
  prisma: {
    booking: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
  },
}));

import { prisma } from '@/lib/server/db/prisma';

describe('BookingsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('listBookings', () => {
    it('should filter bookings for STUDENT role', async () => {
      const mockBookings = [
        {
          id: '1',
          studentId: 'student-1',
          student: { id: 'student-1', name: 'Alice', email: 'alice@test.com', trainingLevel: 'STUDENT_PILOT' },
          instructor: { id: 'instructor-1', name: 'John', email: 'john@test.com' },
        },
      ];

      vi.mocked(prisma.booking.findMany).mockResolvedValue(mockBookings as any);

      const result = await listBookings({
        userId: 'student-1',
        userRole: 'STUDENT',
      });

      expect(prisma.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            studentId: 'student-1',
          }),
        }),
      );

      expect(result).toEqual(mockBookings);
    });

    it('should filter bookings for INSTRUCTOR role', async () => {
      const mockBookings = [
        {
          id: '1',
          instructorId: 'instructor-1',
          student: { id: 'student-1', name: 'Alice', email: 'alice@test.com', trainingLevel: 'STUDENT_PILOT' },
          instructor: { id: 'instructor-1', name: 'John', email: 'john@test.com' },
        },
      ];

      vi.mocked(prisma.booking.findMany).mockResolvedValue(mockBookings as any);

      const result = await listBookings({
        userId: 'instructor-1',
        userRole: 'INSTRUCTOR',
      });

      expect(prisma.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            instructorId: 'instructor-1',
          }),
        }),
      );

      expect(result).toEqual(mockBookings);
    });

    it('should not filter bookings for ADMIN role', async () => {
      const mockBookings = [
        {
          id: '1',
          student: { id: 'student-1', name: 'Alice', email: 'alice@test.com', trainingLevel: 'STUDENT_PILOT' },
          instructor: { id: 'instructor-1', name: 'John', email: 'john@test.com' },
        },
      ];

      vi.mocked(prisma.booking.findMany).mockResolvedValue(mockBookings as any);

      const result = await listBookings({
        userId: 'admin-1',
        userRole: 'ADMIN',
      });

      // Admin should not have studentId or instructorId filter
      expect(prisma.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.not.objectContaining({
            studentId: expect.anything(),
            instructorId: expect.anything(),
          }),
        }),
      );

      expect(result).toEqual(mockBookings);
    });
  });

  describe('getBooking', () => {
    it('should throw FORBIDDEN error when STUDENT tries to access another student booking', async () => {
      const mockBooking = {
        id: '1',
        studentId: 'student-2', // Different student
        instructorId: 'instructor-1',
        student: { id: 'student-2', name: 'Bob', email: 'bob@test.com', trainingLevel: 'STUDENT_PILOT' },
        instructor: { id: 'instructor-1', name: 'John', email: 'john@test.com' },
      };

      vi.mocked(prisma.booking.findUnique).mockResolvedValue(mockBooking as any);

      await expect(
        getBooking('1', 'student-1', 'STUDENT'),
      ).rejects.toThrow(TRPCError);
    });

    it('should allow STUDENT to access own booking', async () => {
      const mockBooking = {
        id: '1',
        studentId: 'student-1',
        instructorId: 'instructor-1',
        student: { id: 'student-1', name: 'Alice', email: 'alice@test.com', trainingLevel: 'STUDENT_PILOT' },
        instructor: { id: 'instructor-1', name: 'John', email: 'john@test.com' },
      };

      vi.mocked(prisma.booking.findUnique).mockResolvedValue(mockBooking as any);

      const result = await getBooking('1', 'student-1', 'STUDENT');

      expect(result).toEqual(mockBooking);
    });

    it('should allow ADMIN to access any booking', async () => {
      const mockBooking = {
        id: '1',
        studentId: 'student-1',
        instructorId: 'instructor-1',
        student: { id: 'student-1', name: 'Alice', email: 'alice@test.com', trainingLevel: 'STUDENT_PILOT' },
        instructor: { id: 'instructor-1', name: 'John', email: 'john@test.com' },
      };

      vi.mocked(prisma.booking.findUnique).mockResolvedValue(mockBooking as any);

      const result = await getBooking('1', 'admin-1', 'ADMIN');

      expect(result).toEqual(mockBooking);
    });
  });

  describe('createBooking', () => {
    it('should prevent STUDENT from creating booking for another student', async () => {
      const input = {
        studentId: 'student-2', // Different student
        instructorId: 'instructor-1',
        departureLocation: 'KPAO',
        arrivalLocation: 'KSQL',
        scheduledStart: new Date(),
        scheduledEnd: new Date(),
        duration: 120,
        flightType: 'CROSS_COUNTRY',
      };

      await expect(
        createBooking(input, 'student-1', 'STUDENT'),
      ).rejects.toThrow(TRPCError);
    });

    it('should validate student exists and has STUDENT role', async () => {
      const input = {
        studentId: 'student-1',
        instructorId: 'instructor-1',
        departureLocation: 'KPAO',
        arrivalLocation: 'KSQL',
        scheduledStart: new Date(),
        scheduledEnd: new Date(),
        duration: 120,
        flightType: 'CROSS_COUNTRY',
      };

      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
        id: 'student-1',
        role: 'INSTRUCTOR', // Wrong role!
      } as any);

      await expect(
        createBooking(input, 'student-1', 'STUDENT'),
      ).rejects.toThrow('Invalid student ID');
    });

    it('should create booking successfully', async () => {
      const input = {
        studentId: 'student-1',
        instructorId: 'instructor-1',
        departureLocation: 'KPAO',
        arrivalLocation: 'KSQL',
        scheduledStart: new Date(),
        scheduledEnd: new Date(),
        duration: 120,
        flightType: 'CROSS_COUNTRY',
      };

      const mockStudent = { id: 'student-1', role: 'STUDENT' };
      const mockInstructor = { id: 'instructor-1', role: 'INSTRUCTOR' };
      const mockBooking = { id: '1', ...input, status: 'SCHEDULED' };

      vi.mocked(prisma.user.findUnique)
        .mockResolvedValueOnce(mockStudent as any)
        .mockResolvedValueOnce(mockInstructor as any);

      vi.mocked(prisma.booking.create).mockResolvedValue(mockBooking as any);

      const result = await createBooking(input, 'student-1', 'STUDENT');

      expect(result).toEqual(mockBooking);
      expect(prisma.booking.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          ...input,
          status: 'SCHEDULED',
        }),
      });
    });
  });

  describe('updateBookingStatus', () => {
    it('should update booking status successfully', async () => {
      const mockBooking = {
        id: '1',
        studentId: 'student-1',
        instructorId: 'instructor-1',
        status: 'SCHEDULED',
      };

      const mockUpdatedBooking = {
        ...mockBooking,
        status: 'CONFIRMED',
      };

      vi.mocked(prisma.booking.findUnique).mockResolvedValue(mockBooking as any);
      vi.mocked(prisma.booking.update).mockResolvedValue(mockUpdatedBooking as any);

      const result = await updateBookingStatus('1', 'CONFIRMED', 'student-1', 'STUDENT');

      expect(result.status).toBe('CONFIRMED');
      expect(prisma.booking.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: { status: 'CONFIRMED' },
      });
    });
  });

  describe('deleteBooking', () => {
    it('should soft delete booking by setting status to CANCELLED', async () => {
      const mockBooking = {
        id: '1',
        studentId: 'student-1',
        instructorId: 'instructor-1',
        status: 'SCHEDULED',
      };

      vi.mocked(prisma.booking.findUnique).mockResolvedValue(mockBooking as any);
      vi.mocked(prisma.booking.update).mockResolvedValue({
        ...mockBooking,
        status: 'CANCELLED',
      } as any);

      await deleteBooking('1', 'student-1', 'STUDENT');

      expect(prisma.booking.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: { status: 'CANCELLED' },
      });
    });

    it('should prevent STUDENT from canceling another student booking', async () => {
      const mockBooking = {
        id: '1',
        studentId: 'student-2', // Different student
        instructorId: 'instructor-1',
      };

      vi.mocked(prisma.booking.findUnique).mockResolvedValue(mockBooking as any);

      await expect(
        deleteBooking('1', 'student-1', 'STUDENT'),
      ).rejects.toThrow(TRPCError);
    });
  });
});
