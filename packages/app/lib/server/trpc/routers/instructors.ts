/**
 * Instructors router
 * Handles instructor availability and scheduling queries/mutations
 */

import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '../init';
import {
  listInstructors,
  getInstructorAvailability,
  updateInstructorAvailability,
  addAvailabilityException,
  removeAvailabilityException,
  getInstructorBookings,
  checkInstructorAvailability,
} from '@/lib/server/services/instructors.service';

// ============================================================================
// INPUT SCHEMAS
// ============================================================================

const timeSlotSchema = z.object({
  start: z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, 'Must be HH:mm format'),
  end: z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, 'Must be HH:mm format'),
});

const weeklyScheduleSchema = z.object({
  MON: z.array(timeSlotSchema).optional(),
  TUE: z.array(timeSlotSchema).optional(),
  WED: z.array(timeSlotSchema).optional(),
  THU: z.array(timeSlotSchema).optional(),
  FRI: z.array(timeSlotSchema).optional(),
  SAT: z.array(timeSlotSchema).optional(),
  SUN: z.array(timeSlotSchema).optional(),
});

const availabilityExceptionSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD format'),
  available: z.boolean(),
  timeSlots: z.array(timeSlotSchema).optional(),
  reason: z.string().optional(),
});

const updateAvailabilitySchema = z.object({
  instructorId: z.string().uuid(),
  weeklySchedule: weeklyScheduleSchema.optional(),
  exceptions: z.array(availabilityExceptionSchema).optional(),
});

const checkAvailabilitySchema = z.object({
  instructorId: z.string().uuid(),
  requestedStart: z.date(),
  requestedEnd: z.date(),
});

// ============================================================================
// ROUTER
// ============================================================================

export const instructorsRouter = createTRPCRouter({
  /**
   * List all instructors
   * Returns basic info + availability status
   * Useful for booking creation UI
   */
  list: protectedProcedure.query(async () => {
    return listInstructors();
  }),

  /**
   * Get availability pattern for a specific instructor
   */
  getAvailability: protectedProcedure
    .input(z.object({ instructorId: z.string().uuid() }))
    .query(async ({ input }) => {
      return getInstructorAvailability(input.instructorId);
    }),

  /**
   * Update instructor availability pattern
   * Only the instructor themselves or admins can update
   */
  updateAvailability: protectedProcedure
    .input(updateAvailabilitySchema)
    .mutation(async ({ ctx, input }) => {
      const { instructorId, ...updateData } = input;
      return updateInstructorAvailability(
        instructorId,
        updateData,
        ctx.user.id,
        ctx.user.role,
      );
    }),

  /**
   * Add a single availability exception
   * Useful for adding days off or special hours
   */
  addException: protectedProcedure
    .input(
      z.object({
        instructorId: z.string().uuid(),
        exception: availabilityExceptionSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return addAvailabilityException(
        input.instructorId,
        input.exception,
        ctx.user.id,
        ctx.user.role,
      );
    }),

  /**
   * Remove an availability exception by date
   */
  removeException: protectedProcedure
    .input(
      z.object({
        instructorId: z.string().uuid(),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return removeAvailabilityException(
        input.instructorId,
        input.date,
        ctx.user.id,
        ctx.user.role,
      );
    }),

  /**
   * Get all bookings for an instructor within a date range
   * Instructors can see their own, admins can see all
   */
  getBookings: protectedProcedure
    .input(
      z.object({
        instructorId: z.string().uuid(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      return getInstructorBookings(
        input.instructorId,
        input.startDate,
        input.endDate,
        ctx.user.id,
        ctx.user.role,
      );
    }),

  /**
   * Check if instructor is available at a specific date/time
   * Considers weekly schedule, exceptions, and existing bookings
   */
  checkAvailability: protectedProcedure
    .input(checkAvailabilitySchema)
    .query(async ({ input }) => {
      return checkInstructorAvailability(
        input.instructorId,
        input.requestedStart,
        input.requestedEnd,
      );
    }),

  /**
   * Get my availability (for instructor users)
   * Convenience endpoint for instructors to view/edit their own availability
   */
  myAvailability: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role !== 'INSTRUCTOR') {
      throw new Error('Only instructors can access this endpoint');
    }

    return getInstructorAvailability(ctx.user.id);
  }),

  /**
   * Update my availability (for instructor users)
   * Convenience endpoint for instructors
   */
  updateMyAvailability: protectedProcedure
    .input(
      z.object({
        weeklySchedule: weeklyScheduleSchema.optional(),
        exceptions: z.array(availabilityExceptionSchema).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== 'INSTRUCTOR') {
        throw new Error('Only instructors can update availability');
      }

      return updateInstructorAvailability(ctx.user.id, input, ctx.user.id, ctx.user.role);
    }),

  /**
   * Get my bookings (for instructor users)
   * Shows all bookings for the authenticated instructor
   */
  myBookings: protectedProcedure
    .input(
      z.object({
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      if (ctx.user.role !== 'INSTRUCTOR') {
        throw new Error('Only instructors can access this endpoint');
      }

      return getInstructorBookings(
        ctx.user.id,
        input.startDate,
        input.endDate,
        ctx.user.id,
        ctx.user.role,
      );
    }),
});
