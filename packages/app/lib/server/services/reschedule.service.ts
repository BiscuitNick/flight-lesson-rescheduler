/**
 * Reschedule Service
 * Business logic for AI-generated reschedule suggestions with RBAC
 */

import { prisma } from '@/lib/server/db/prisma';
import type { RescheduleLog, UserRole } from '@prisma/client';
import { TRPCError } from '@trpc/server';
import { getBooking } from './bookings.service';

// ============================================================================
// TYPES
// ============================================================================

export interface RescheduleSuggestion extends RescheduleLog {
  booking: {
    id: string;
    departureLocation: string;
    arrivalLocation: string;
    scheduledStart: Date;
    scheduledEnd: Date;
    student: {
      id: string;
      name: string;
      email: string;
    };
    instructor: {
      id: string;
      name: string;
      email: string;
    };
  };
}

export interface RescheduleHistoryItem extends RescheduleLog {
  booking: {
    id: string;
    departureLocation: string;
    arrivalLocation: string;
  };
}

// ============================================================================
// GET SUGGESTIONS FOR BOOKING
// ============================================================================

/**
 * Get all reschedule suggestions for a booking
 * - Students can view suggestions for their own bookings
 * - Instructors can view suggestions for assigned bookings
 * - Admins can view any suggestions
 */
export async function getSuggestionsForBooking(
  bookingId: string,
  userId: string,
  userRole: UserRole,
): Promise<RescheduleSuggestion[]> {
  // First verify user can access this booking (RBAC check)
  const booking = await getBooking(bookingId, userId, userRole);

  if (!booking) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Booking not found',
    });
  }

  // Get all suggestions for this booking, ordered by confidence
  const suggestions = await prisma.rescheduleLog.findMany({
    where: {
      bookingId,
    },
    include: {
      booking: {
        include: {
          student: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          instructor: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      },
    },
    orderBy: [
      { isSelected: 'desc' }, // Selected suggestions first
      { confidence: 'desc' }, // Then by confidence
      { createdAt: 'desc' },  // Then by recency
    ],
  });

  return suggestions as RescheduleSuggestion[];
}

// ============================================================================
// CONFIRM SUGGESTION
// ============================================================================

/**
 * Confirm a reschedule suggestion
 * - Students can confirm suggestions for their own bookings
 * - Instructors can override/confirm for assigned bookings
 * - Admins can confirm any suggestions
 *
 * This updates the booking with new date/time and marks the suggestion as selected
 */
export async function confirmSuggestion(
  suggestionId: string,
  userId: string,
  userRole: UserRole,
): Promise<RescheduleSuggestion> {
  // Get the suggestion with booking details
  const suggestion = await prisma.rescheduleLog.findUnique({
    where: { id: suggestionId },
    include: {
      booking: {
        include: {
          student: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          instructor: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      },
    },
  });

  if (!suggestion) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Reschedule suggestion not found',
    });
  }

  // RBAC check
  if (userRole === 'STUDENT' && suggestion.booking.studentId !== userId) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'You can only confirm suggestions for your own bookings',
    });
  }

  if (userRole === 'INSTRUCTOR' && suggestion.booking.instructorId !== userId) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'You can only confirm suggestions for bookings you are assigned to',
    });
  }

  // Check if suggestion is already selected
  if (suggestion.isSelected) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'This suggestion has already been confirmed',
    });
  }

  // Calculate new scheduled end based on duration
  const duration = suggestion.booking.duration * 60 * 1000; // Convert minutes to ms
  const newScheduledEnd = new Date(suggestion.proposedDateTime.getTime() + duration);

  // Use transaction to update both the booking and the suggestion atomically
  const result = await prisma.$transaction(async (tx) => {
    // Mark any previously selected suggestions as unselected
    await tx.rescheduleLog.updateMany({
      where: {
        bookingId: suggestion.bookingId,
        isSelected: true,
      },
      data: {
        isSelected: false,
        selectedAt: null,
      },
    });

    // Mark this suggestion as selected
    const updatedSuggestion = await tx.rescheduleLog.update({
      where: { id: suggestionId },
      data: {
        isSelected: true,
        selectedAt: new Date(),
      },
      include: {
        booking: {
          include: {
            student: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            instructor: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });

    // Update the booking with new date/time and status
    await tx.booking.update({
      where: { id: suggestion.bookingId },
      data: {
        scheduledStart: suggestion.proposedDateTime,
        scheduledEnd: newScheduledEnd,
        status: 'CONFIRMED',
      },
    });

    return updatedSuggestion;
  });

  return result as RescheduleSuggestion;
}

// ============================================================================
// DECLINE SUGGESTION
// ============================================================================

/**
 * Decline a reschedule suggestion
 * - Students can decline suggestions for their own bookings
 * - Instructors can decline for assigned bookings
 * - Admins can decline any suggestions
 *
 * This soft-deletes the suggestion (we keep it for audit trail but mark it as declined)
 */
export async function declineSuggestion(
  suggestionId: string,
  userId: string,
  userRole: UserRole,
  reason?: string,
): Promise<void> {
  // Get the suggestion with booking details
  const suggestion = await prisma.rescheduleLog.findUnique({
    where: { id: suggestionId },
    include: {
      booking: true,
    },
  });

  if (!suggestion) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Reschedule suggestion not found',
    });
  }

  // RBAC check
  if (userRole === 'STUDENT' && suggestion.booking.studentId !== userId) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'You can only decline suggestions for your own bookings',
    });
  }

  if (userRole === 'INSTRUCTOR' && suggestion.booking.instructorId !== userId) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'You can only decline suggestions for bookings you are assigned to',
    });
  }

  // Update metadata to mark as declined
  const currentMetadata = (suggestion.metadata as Record<string, any>) || {};
  await prisma.rescheduleLog.update({
    where: { id: suggestionId },
    data: {
      metadata: {
        ...currentMetadata,
        declined: true,
        declinedAt: new Date().toISOString(),
        declineReason: reason,
      },
    },
  });
}

// ============================================================================
// REQUEST MANUAL RESCHEDULE
// ============================================================================

/**
 * Request manual rescheduling (bypass AI suggestions)
 * - Students can request manual reschedule for their bookings
 * - Instructors can request for assigned bookings
 * - Admins can request for any booking
 *
 * This updates booking status to indicate manual intervention is needed
 */
export async function requestManualReschedule(
  bookingId: string,
  userId: string,
  userRole: UserRole,
  reason?: string,
): Promise<void> {
  // First verify user can access this booking
  const booking = await getBooking(bookingId, userId, userRole);

  if (!booking) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Booking not found',
    });
  }

  // Update booking status and add note
  await prisma.booking.update({
    where: { id: bookingId },
    data: {
      status: 'AWAITING_RESPONSE',
      notes: reason
        ? `${booking.notes ? booking.notes + '\n\n' : ''}Manual reschedule requested: ${reason}`
        : booking.notes,
    },
  });

  // TODO: Trigger notification to admin/instructor
  // This would integrate with the notification service from Task 9
}

// ============================================================================
// GET RESCHEDULE TIMELINE
// ============================================================================

/**
 * Get all reschedule activity for a booking as a timeline
 * Shows suggestions, confirmations, and declinations in chronological order
 */
export async function getRescheduleTimeline(
  bookingId: string,
  userId: string,
  userRole: UserRole,
): Promise<RescheduleHistoryItem[]> {
  // First verify user can access this booking
  const booking = await getBooking(bookingId, userId, userRole);

  if (!booking) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Booking not found',
    });
  }

  const timeline = await prisma.rescheduleLog.findMany({
    where: { bookingId },
    include: {
      booking: {
        select: {
          id: true,
          departureLocation: true,
          arrivalLocation: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return timeline as RescheduleHistoryItem[];
}

// ============================================================================
// GET PENDING SUGGESTIONS FOR USER
// ============================================================================

/**
 * Get all pending (unconfirmed) reschedule suggestions for a user
 * Used for dashboard notifications/widgets
 */
export async function getPendingSuggestionsForUser(
  userId: string,
  userRole: UserRole,
): Promise<RescheduleSuggestion[]> {
  const whereClause: any = {
    isSelected: false,
    booking: {
      status: 'AWAITING_RESPONSE',
    },
  };

  // Role-based filtering
  if (userRole === 'STUDENT') {
    whereClause.booking.studentId = userId;
  } else if (userRole === 'INSTRUCTOR') {
    whereClause.booking.instructorId = userId;
  }
  // ADMIN sees all

  // Exclude declined suggestions
  const suggestions = await prisma.rescheduleLog.findMany({
    where: whereClause,
    include: {
      booking: {
        include: {
          student: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          instructor: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      },
    },
    orderBy: [
      { confidence: 'desc' },
      { createdAt: 'desc' },
    ],
  });

  // Filter out declined suggestions (checking metadata)
  return suggestions.filter((s) => {
    const metadata = s.metadata as Record<string, any> | null;
    return !metadata?.declined;
  }) as RescheduleSuggestion[];
}
