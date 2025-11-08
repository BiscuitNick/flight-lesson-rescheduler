/**
 * Bookings router
 * Handles booking-related queries and mutations with RBAC
 */

import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '../init';
import {
  listBookings,
  getBooking,
  createBooking,
  updateBooking,
  updateBookingStatus,
  deleteBooking,
  getBookingWeatherHistory,
} from '@/lib/server/services/bookings.service';

// ============================================================================
// INPUT SCHEMAS
// ============================================================================

const createBookingSchema = z.object({
  studentId: z.string().uuid(),
  instructorId: z.string().uuid(),
  departureLocation: z.string().min(1),
  arrivalLocation: z.string().min(1),
  scheduledStart: z.date(),
  scheduledEnd: z.date(),
  duration: z.number().int().positive(),
  flightType: z.string().min(1),
  notes: z.string().optional(),
});

const updateBookingSchema = z.object({
  id: z.string().uuid(),
  departureLocation: z.string().min(1).optional(),
  arrivalLocation: z.string().min(1).optional(),
  scheduledStart: z.date().optional(),
  scheduledEnd: z.date().optional(),
  duration: z.number().int().positive().optional(),
  flightType: z.string().min(1).optional(),
  notes: z.string().optional(),
});

const updateBookingStatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum([
    'SCHEDULED',
    'WEATHER_HOLD',
    'AWAITING_RESPONSE',
    'CONFIRMED',
    'CANCELLED',
    'COMPLETED',
  ]),
});

const listBookingsSchema = z.object({
  status: z
    .enum([
      'SCHEDULED',
      'WEATHER_HOLD',
      'AWAITING_RESPONSE',
      'CONFIRMED',
      'CANCELLED',
      'COMPLETED',
    ])
    .optional(),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
  studentId: z.string().uuid().optional(),
  instructorId: z.string().uuid().optional(),
});

// ============================================================================
// ROUTER
// ============================================================================

export const bookingsRouter = createTRPCRouter({
  /**
   * List bookings with RBAC filtering
   * - Students see only their own bookings
   * - Instructors see bookings they're assigned to
   * - Admins see all bookings (with optional filters)
   */
  list: protectedProcedure.input(listBookingsSchema).query(async ({ ctx, input }) => {
    return listBookings({
      userId: ctx.user.id,
      userRole: ctx.user.role,
      status: input.status,
      startDate: input.startDate,
      endDate: input.endDate,
      studentId: input.studentId,
      instructorId: input.instructorId,
    });
  }),

  /**
   * Get a single booking by ID with RBAC checks
   */
  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return getBooking(input.id, ctx.user.id, ctx.user.role);
    }),

  /**
   * Create a new booking
   * Students can only book for themselves
   * Instructors and admins can book for any student
   */
  create: protectedProcedure.input(createBookingSchema).mutation(async ({ ctx, input }) => {
    return createBooking(input, ctx.user.id, ctx.user.role);
  }),

  /**
   * Update booking details
   * Students can update their own, instructors their assigned, admins all
   */
  update: protectedProcedure.input(updateBookingSchema).mutation(async ({ ctx, input }) => {
    const { id, ...updateData } = input;
    return updateBooking(id, updateData, ctx.user.id, ctx.user.role);
  }),

  /**
   * Update booking status
   * Used for state transitions (e.g., SCHEDULED -> WEATHER_HOLD)
   */
  updateStatus: protectedProcedure
    .input(updateBookingStatusSchema)
    .mutation(async ({ ctx, input }) => {
      return updateBookingStatus(input.id, input.status, ctx.user.id, ctx.user.role);
    }),

  /**
   * Cancel (delete) a booking
   * Sets status to CANCELLED
   */
  cancel: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await deleteBooking(input.id, ctx.user.id, ctx.user.role);
      return { success: true };
    }),

  /**
   * Get weather check history for a booking
   */
  weatherHistory: protectedProcedure
    .input(z.object({ bookingId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return getBookingWeatherHistory(input.bookingId, ctx.user.id, ctx.user.role);
    }),

  /**
   * Get upcoming bookings for the authenticated user
   * Convenience endpoint for dashboard
   */
  upcoming: protectedProcedure.query(async ({ ctx }) => {
    const now = new Date();
    const futureDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days ahead

    return listBookings({
      userId: ctx.user.id,
      userRole: ctx.user.role,
      startDate: now,
      endDate: futureDate,
    });
  }),

  /**
   * Get booking statistics
   * Returns counts by status for the authenticated user
   */
  stats: protectedProcedure.query(async ({ ctx }) => {
    const whereClause: any = {};

    // Role-based filtering
    if (ctx.user.role === 'STUDENT') {
      whereClause.studentId = ctx.user.id;
    } else if (ctx.user.role === 'INSTRUCTOR') {
      whereClause.instructorId = ctx.user.id;
    }
    // ADMIN sees all

    const [total, scheduled, weatherHold, awaitingResponse, confirmed, cancelled, completed] =
      await Promise.all([
        ctx.prisma.booking.count({ where: whereClause }),
        ctx.prisma.booking.count({ where: { ...whereClause, status: 'SCHEDULED' } }),
        ctx.prisma.booking.count({ where: { ...whereClause, status: 'WEATHER_HOLD' } }),
        ctx.prisma.booking.count({ where: { ...whereClause, status: 'AWAITING_RESPONSE' } }),
        ctx.prisma.booking.count({ where: { ...whereClause, status: 'CONFIRMED' } }),
        ctx.prisma.booking.count({ where: { ...whereClause, status: 'CANCELLED' } }),
        ctx.prisma.booking.count({ where: { ...whereClause, status: 'COMPLETED' } }),
      ]);

    return {
      total,
      byStatus: {
        scheduled,
        weatherHold,
        awaitingResponse,
        confirmed,
        cancelled,
        completed,
      },
    };
  }),
});
