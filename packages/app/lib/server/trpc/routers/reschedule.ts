/**
 * Reschedule router
 * Handles AI-generated reschedule suggestions with RBAC
 */

import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '../init';
import {
  getSuggestionsForBooking,
  confirmSuggestion,
  declineSuggestion,
  requestManualReschedule,
  getRescheduleTimeline,
  getPendingSuggestionsForUser,
} from '@/lib/server/services/reschedule.service';

// ============================================================================
// INPUT SCHEMAS
// ============================================================================

const getSuggestionsSchema = z.object({
  bookingId: z.string().uuid(),
});

const confirmSuggestionSchema = z.object({
  suggestionId: z.string().uuid(),
});

const declineSuggestionSchema = z.object({
  suggestionId: z.string().uuid(),
  reason: z.string().optional(),
});

const requestManualSchema = z.object({
  bookingId: z.string().uuid(),
  reason: z.string().optional(),
});

const getTimelineSchema = z.object({
  bookingId: z.string().uuid(),
});

// ============================================================================
// ROUTER
// ============================================================================

export const rescheduleRouter = createTRPCRouter({
  /**
   * Get all AI-generated reschedule suggestions for a booking
   * - Students see suggestions for their own bookings
   * - Instructors see suggestions for assigned bookings
   * - Admins see all suggestions
   */
  getSuggestions: protectedProcedure
    .input(getSuggestionsSchema)
    .query(async ({ ctx, input }) => {
      return getSuggestionsForBooking(input.bookingId, ctx.user.id, ctx.user.role);
    }),

  /**
   * Confirm a reschedule suggestion
   * This updates the booking with the new date/time and marks suggestion as selected
   * - Students can confirm their own bookings
   * - Instructors can override for assigned bookings
   * - Admins can confirm any
   */
  confirm: protectedProcedure
    .input(confirmSuggestionSchema)
    .mutation(async ({ ctx, input }) => {
      return confirmSuggestion(input.suggestionId, ctx.user.id, ctx.user.role);
    }),

  /**
   * Decline a reschedule suggestion
   * This marks the suggestion as declined (soft delete for audit trail)
   * - Students can decline for their bookings
   * - Instructors can decline for assigned bookings
   * - Admins can decline any
   */
  decline: protectedProcedure
    .input(declineSuggestionSchema)
    .mutation(async ({ ctx, input }) => {
      await declineSuggestion(input.suggestionId, ctx.user.id, ctx.user.role, input.reason);
      return { success: true };
    }),

  /**
   * Request manual rescheduling (bypass AI)
   * Sets booking to AWAITING_RESPONSE and notifies admin/instructor
   * - Students can request for their bookings
   * - Instructors can request for assigned bookings
   * - Admins can request for any booking
   */
  requestManual: protectedProcedure
    .input(requestManualSchema)
    .mutation(async ({ ctx, input }) => {
      await requestManualReschedule(input.bookingId, ctx.user.id, ctx.user.role, input.reason);
      return { success: true };
    }),

  /**
   * Get reschedule timeline for a booking
   * Shows all suggestions, confirmations, and declinations
   */
  getTimeline: protectedProcedure.input(getTimelineSchema).query(async ({ ctx, input }) => {
    return getRescheduleTimeline(input.bookingId, ctx.user.id, ctx.user.role);
  }),

  /**
   * Get all pending suggestions for the authenticated user
   * Used for dashboard notifications and widgets
   * - Students see pending suggestions for their bookings
   * - Instructors see pending for assigned bookings
   * - Admins see all pending
   */
  getPending: protectedProcedure.query(async ({ ctx }) => {
    return getPendingSuggestionsForUser(ctx.user.id, ctx.user.role);
  }),

  /**
   * Get statistics about reschedule suggestions
   * Returns counts of pending, confirmed, and declined suggestions
   */
  stats: protectedProcedure.query(async ({ ctx }) => {
    const whereClause: any = {};

    // Role-based filtering
    if (ctx.user.role === 'STUDENT') {
      whereClause.booking = { studentId: ctx.user.id };
    } else if (ctx.user.role === 'INSTRUCTOR') {
      whereClause.booking = { instructorId: ctx.user.id };
    }
    // ADMIN sees all

    const [total, selected, pending] = await Promise.all([
      ctx.prisma.rescheduleLog.count({ where: whereClause }),
      ctx.prisma.rescheduleLog.count({ where: { ...whereClause, isSelected: true } }),
      ctx.prisma.rescheduleLog.count({
        where: {
          ...whereClause,
          isSelected: false,
          booking: { status: 'AWAITING_RESPONSE' },
        },
      }),
    ]);

    return {
      total,
      selected,
      pending,
      declined: total - selected - pending,
    };
  }),
});
