/**
 * Reschedule Service Tests
 * Unit tests for reschedule business logic with RBAC
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TRPCError } from '@trpc/server';
import {
  getSuggestionsForBooking,
  confirmSuggestion,
  declineSuggestion,
  requestManualReschedule,
  getRescheduleTimeline,
  getPendingSuggestionsForUser,
} from '../reschedule.service';

// Mock Prisma client
vi.mock('@/lib/server/db/prisma', () => ({
  prisma: {
    rescheduleLog: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      count: vi.fn(),
    },
    booking: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

// Mock bookings service
vi.mock('../bookings.service', () => ({
  getBooking: vi.fn(),
}));

import { prisma } from '@/lib/server/db/prisma';
import { getBooking } from '../bookings.service';

describe('RescheduleService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getSuggestionsForBooking', () => {
    it('should get suggestions for a valid booking', async () => {
      const mockBooking = {
        id: 'booking-1',
        studentId: 'student-1',
        instructorId: 'instructor-1',
        student: { id: 'student-1', name: 'Alice', email: 'alice@test.com' },
        instructor: { id: 'instructor-1', name: 'John', email: 'john@test.com' },
      };

      const mockSuggestions = [
        {
          id: 'suggestion-1',
          bookingId: 'booking-1',
          proposedDateTime: new Date('2024-12-01T10:00:00Z'),
          reasoning: 'Better weather conditions',
          confidence: 0.9,
          isSelected: false,
          booking: mockBooking,
        },
      ];

      vi.mocked(getBooking).mockResolvedValue(mockBooking as any);
      vi.mocked(prisma.rescheduleLog.findMany).mockResolvedValue(mockSuggestions as any);

      const result = await getSuggestionsForBooking('booking-1', 'student-1', 'STUDENT');

      expect(getBooking).toHaveBeenCalledWith('booking-1', 'student-1', 'STUDENT');
      expect(prisma.rescheduleLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { bookingId: 'booking-1' },
        }),
      );
      expect(result).toEqual(mockSuggestions);
    });

    it('should throw NOT_FOUND if booking does not exist', async () => {
      vi.mocked(getBooking).mockResolvedValue(null);

      await expect(
        getSuggestionsForBooking('invalid-booking', 'student-1', 'STUDENT'),
      ).rejects.toThrow(TRPCError);
    });
  });

  describe('confirmSuggestion', () => {
    it('should confirm a suggestion and update booking for STUDENT', async () => {
      const mockSuggestion = {
        id: 'suggestion-1',
        bookingId: 'booking-1',
        proposedDateTime: new Date('2024-12-01T10:00:00Z'),
        reasoning: 'Better weather',
        confidence: 0.9,
        isSelected: false,
        metadata: null,
        booking: {
          id: 'booking-1',
          studentId: 'student-1',
          instructorId: 'instructor-1',
          duration: 60,
          student: { id: 'student-1', name: 'Alice', email: 'alice@test.com' },
          instructor: { id: 'instructor-1', name: 'John', email: 'john@test.com' },
        },
      };

      const updatedSuggestion = {
        ...mockSuggestion,
        isSelected: true,
        selectedAt: new Date(),
      };

      vi.mocked(prisma.rescheduleLog.findUnique).mockResolvedValue(mockSuggestion as any);
      vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
        return callback({
          rescheduleLog: {
            updateMany: vi.fn(),
            update: vi.fn().mockResolvedValue(updatedSuggestion),
          },
          booking: {
            update: vi.fn(),
          },
        });
      });

      const result = await confirmSuggestion('suggestion-1', 'student-1', 'STUDENT');

      expect(prisma.rescheduleLog.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'suggestion-1' },
        }),
      );
      expect(result.isSelected).toBe(true);
    });

    it('should throw FORBIDDEN if student tries to confirm another students booking', async () => {
      const mockSuggestion = {
        id: 'suggestion-1',
        bookingId: 'booking-1',
        booking: {
          studentId: 'student-2',
          instructorId: 'instructor-1',
        },
      };

      vi.mocked(prisma.rescheduleLog.findUnique).mockResolvedValue(mockSuggestion as any);

      await expect(confirmSuggestion('suggestion-1', 'student-1', 'STUDENT')).rejects.toThrow(
        TRPCError,
      );
    });

    it('should throw BAD_REQUEST if suggestion already selected', async () => {
      const mockSuggestion = {
        id: 'suggestion-1',
        isSelected: true,
        booking: {
          studentId: 'student-1',
          instructorId: 'instructor-1',
        },
      };

      vi.mocked(prisma.rescheduleLog.findUnique).mockResolvedValue(mockSuggestion as any);

      await expect(confirmSuggestion('suggestion-1', 'student-1', 'STUDENT')).rejects.toThrow(
        TRPCError,
      );
    });
  });

  describe('declineSuggestion', () => {
    it('should decline a suggestion for STUDENT', async () => {
      const mockSuggestion = {
        id: 'suggestion-1',
        bookingId: 'booking-1',
        metadata: null,
        booking: {
          studentId: 'student-1',
          instructorId: 'instructor-1',
        },
      };

      vi.mocked(prisma.rescheduleLog.findUnique).mockResolvedValue(mockSuggestion as any);
      vi.mocked(prisma.rescheduleLog.update).mockResolvedValue(mockSuggestion as any);

      await declineSuggestion('suggestion-1', 'student-1', 'STUDENT', 'Not suitable');

      expect(prisma.rescheduleLog.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'suggestion-1' },
          data: expect.objectContaining({
            metadata: expect.objectContaining({
              declined: true,
              declineReason: 'Not suitable',
            }),
          }),
        }),
      );
    });

    it('should throw FORBIDDEN if student tries to decline another students suggestion', async () => {
      const mockSuggestion = {
        id: 'suggestion-1',
        booking: {
          studentId: 'student-2',
        },
      };

      vi.mocked(prisma.rescheduleLog.findUnique).mockResolvedValue(mockSuggestion as any);

      await expect(
        declineSuggestion('suggestion-1', 'student-1', 'STUDENT'),
      ).rejects.toThrow(TRPCError);
    });
  });

  describe('requestManualReschedule', () => {
    it('should request manual reschedule for valid booking', async () => {
      const mockBooking = {
        id: 'booking-1',
        studentId: 'student-1',
        notes: 'Original notes',
      };

      vi.mocked(getBooking).mockResolvedValue(mockBooking as any);
      vi.mocked(prisma.booking.update).mockResolvedValue(mockBooking as any);

      await requestManualReschedule('booking-1', 'student-1', 'STUDENT', 'Need instructor help');

      expect(prisma.booking.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'booking-1' },
          data: expect.objectContaining({
            status: 'AWAITING_RESPONSE',
          }),
        }),
      );
    });
  });

  describe('getPendingSuggestionsForUser', () => {
    it('should get pending suggestions for STUDENT', async () => {
      const mockSuggestions = [
        {
          id: 'suggestion-1',
          isSelected: false,
          metadata: null,
          booking: {
            studentId: 'student-1',
            status: 'AWAITING_RESPONSE',
          },
        },
      ];

      vi.mocked(prisma.rescheduleLog.findMany).mockResolvedValue(mockSuggestions as any);

      const result = await getPendingSuggestionsForUser('student-1', 'STUDENT');

      expect(prisma.rescheduleLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isSelected: false,
            booking: expect.objectContaining({
              studentId: 'student-1',
              status: 'AWAITING_RESPONSE',
            }),
          }),
        }),
      );
      expect(result).toEqual(mockSuggestions);
    });

    it('should get pending suggestions for INSTRUCTOR', async () => {
      const mockSuggestions = [
        {
          id: 'suggestion-1',
          isSelected: false,
          metadata: null,
          booking: {
            instructorId: 'instructor-1',
            status: 'AWAITING_RESPONSE',
          },
        },
      ];

      vi.mocked(prisma.rescheduleLog.findMany).mockResolvedValue(mockSuggestions as any);

      const result = await getPendingSuggestionsForUser('instructor-1', 'INSTRUCTOR');

      expect(prisma.rescheduleLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isSelected: false,
            booking: expect.objectContaining({
              instructorId: 'instructor-1',
              status: 'AWAITING_RESPONSE',
            }),
          }),
        }),
      );
      expect(result).toEqual(mockSuggestions);
    });

    it('should filter out declined suggestions', async () => {
      const mockSuggestions = [
        {
          id: 'suggestion-1',
          isSelected: false,
          metadata: null,
          booking: { studentId: 'student-1', status: 'AWAITING_RESPONSE' },
        },
        {
          id: 'suggestion-2',
          isSelected: false,
          metadata: { declined: true },
          booking: { studentId: 'student-1', status: 'AWAITING_RESPONSE' },
        },
      ];

      vi.mocked(prisma.rescheduleLog.findMany).mockResolvedValue(mockSuggestions as any);

      const result = await getPendingSuggestionsForUser('student-1', 'STUDENT');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('suggestion-1');
    });
  });
});
