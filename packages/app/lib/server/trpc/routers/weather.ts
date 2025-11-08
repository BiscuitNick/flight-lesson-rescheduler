/**
 * Weather router
 * Handles manual weather checks and route evaluation
 */

import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '../init';
import { assertAdmin, assertRole } from '../context';
import { TRPCError } from '@trpc/server';
import {
  calculateWaypoints,
  createWeatherClient,
  evaluateRoute,
  getViolationReasons,
  type WaypointWeatherData,
} from '@flight-rescheduler/weather-lib';
import type { TrainingLevel as PrismaTrainingLevel, WeatherStatus } from '@prisma/client';

// ============================================================================
// INPUT SCHEMAS
// ============================================================================

const manualCheckSchema = z.object({
  bookingId: z.string().uuid(),
});

const checkRouteSchema = z.object({
  departureLocation: z.string().min(1),
  arrivalLocation: z.string().min(1),
  scheduledStart: z.date(),
  duration: z.number().int().positive(),
  trainingLevel: z.enum(['STUDENT_PILOT', 'PRIVATE_PILOT', 'INSTRUMENT_RATED']),
});

// ============================================================================
// ROUTER
// ============================================================================

export const weatherRouter = createTRPCRouter({
  /**
   * Manual weather check for a booking
   * Admin or instructor can trigger this
   */
  manualCheck: protectedProcedure
    .input(manualCheckSchema)
    .mutation(async ({ ctx, input }) => {
      // Only admins and instructors can trigger manual checks
      assertRole(ctx.user, ['ADMIN', 'INSTRUCTOR']);

      // Fetch booking from database
      const booking = await ctx.prisma.booking.findUnique({
        where: { id: input.bookingId },
        include: {
          student: {
            select: {
              id: true,
              trainingLevel: true,
              name: true,
            },
          },
        },
      });

      if (!booking) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Booking not found',
        });
      }

      if (!booking.student.trainingLevel) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Student training level is not set',
        });
      }

      try {
        // Generate waypoints for the flight route
        const waypoints = calculateWaypoints(
          booking.departureLocation,
          booking.arrivalLocation,
          booking.scheduledStart,
          booking.duration
        );

        // Fetch weather data for each waypoint
        const weatherClient = createWeatherClient();
        const weatherData = await weatherClient.getWeatherForWaypoints(waypoints);

        // Combine waypoints with weather data
        const waypointsWithWeather: WaypointWeatherData[] = waypoints.map((waypoint, i) => ({
          waypoint,
          weather: weatherData[i],
        }));

        // Evaluate route safety
        const routeEvaluation = evaluateRoute(
          waypointsWithWeather,
          booking.student.trainingLevel as PrismaTrainingLevel
        );

        // Map to database WeatherStatus enum
        let weatherStatus: WeatherStatus;
        switch (routeEvaluation.overallStatus) {
          case 'SAFE':
            weatherStatus = 'SAFE';
            break;
          case 'MARGINAL':
            weatherStatus = 'MARGINAL';
            break;
          case 'UNSAFE':
            weatherStatus = 'UNSAFE';
            break;
        }

        // Get violation reasons
        const violationReasons = getViolationReasons(routeEvaluation);

        // Store weather check in database
        const weatherCheck = await ctx.prisma.weatherCheck.create({
          data: {
            bookingId: booking.id,
            waypointData: routeEvaluation.waypoints,
            overallStatus: weatherStatus,
            violationReasons,
          },
        });

        // Update booking status if unsafe
        if (!routeEvaluation.safe) {
          await ctx.prisma.booking.update({
            where: { id: booking.id },
            data: {
              status: 'WEATHER_HOLD',
            },
          });
        }

        return {
          weatherCheckId: weatherCheck.id,
          safe: routeEvaluation.safe,
          overallStatus: routeEvaluation.overallStatus,
          violationSummary: routeEvaluation.violationSummary,
          violationReasons,
          waypointCount: waypoints.length,
          updatedBookingStatus: !routeEvaluation.safe ? 'WEATHER_HOLD' : null,
        };
      } catch (error) {
        if (error instanceof Error) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Weather check failed: ${error.message}`,
          });
        }
        throw error;
      }
    }),

  /**
   * Check route weather without a booking (for planning)
   * Available to all authenticated users
   */
  checkRoute: protectedProcedure
    .input(checkRouteSchema)
    .query(async ({ input }) => {
      try {
        // Generate waypoints for the route
        const waypoints = calculateWaypoints(
          input.departureLocation,
          input.arrivalLocation,
          input.scheduledStart,
          input.duration
        );

        // Fetch weather data
        const weatherClient = createWeatherClient();
        const weatherData = await weatherClient.getWeatherForWaypoints(waypoints);

        // Combine waypoints with weather data
        const waypointsWithWeather: WaypointWeatherData[] = waypoints.map((waypoint, i) => ({
          waypoint,
          weather: weatherData[i],
        }));

        // Evaluate route
        const routeEvaluation = evaluateRoute(waypointsWithWeather, input.trainingLevel);

        const violationReasons = getViolationReasons(routeEvaluation);

        return {
          safe: routeEvaluation.safe,
          overallStatus: routeEvaluation.overallStatus,
          violationSummary: routeEvaluation.violationSummary,
          violationReasons,
          waypoints: routeEvaluation.waypoints.map((wp, i) => ({
            index: i + 1,
            lat: wp.waypoint.lat,
            lon: wp.waypoint.lon,
            timestamp: wp.waypoint.timestamp,
            safe: wp.safe,
            visibility: wp.weather.visibility,
            ceiling: wp.weather.ceiling,
            windSpeed: wp.weather.windSpeed,
            windGust: wp.weather.windGust,
            conditions: wp.weather.conditions,
            violations: wp.violations.map((v) => v.reason),
          })),
        };
      } catch (error) {
        if (error instanceof Error) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Route weather check failed: ${error.message}`,
          });
        }
        throw error;
      }
    }),

  /**
   * Get weather check history for a booking
   * Students can view their own bookings, instructors/admins can view all
   */
  getHistory: protectedProcedure
    .input(z.object({ bookingId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      // Fetch booking to check ownership
      const booking = await ctx.prisma.booking.findUnique({
        where: { id: input.bookingId },
        select: { studentId: true, instructorId: true },
      });

      if (!booking) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Booking not found',
        });
      }

      // Check authorization
      const isStudent = ctx.user?.id === booking.studentId;
      const isInstructor = ctx.user?.id === booking.instructorId;
      const isAdmin = ctx.user?.role === 'ADMIN';

      if (!isStudent && !isInstructor && !isAdmin) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You do not have permission to view this booking',
        });
      }

      // Fetch weather checks
      const weatherChecks = await ctx.prisma.weatherCheck.findMany({
        where: { bookingId: input.bookingId },
        orderBy: { timestamp: 'desc' },
        take: 10,
      });

      return weatherChecks.map((check) => ({
        id: check.id,
        timestamp: check.timestamp,
        overallStatus: check.overallStatus,
        violationReasons: check.violationReasons,
        waypointCount: Array.isArray(check.waypointData)
          ? (check.waypointData as unknown[]).length
          : 0,
      }));
    }),

  /**
   * Admin-only: Get weather check statistics
   */
  getStatistics: protectedProcedure.query(async ({ ctx }) => {
    assertAdmin(ctx.user);

    const [totalChecks, safeChecks, unsafeChecks, marginalChecks] = await Promise.all([
      ctx.prisma.weatherCheck.count(),
      ctx.prisma.weatherCheck.count({ where: { overallStatus: 'SAFE' } }),
      ctx.prisma.weatherCheck.count({ where: { overallStatus: 'UNSAFE' } }),
      ctx.prisma.weatherCheck.count({ where: { overallStatus: 'MARGINAL' } }),
    ]);

    return {
      total: totalChecks,
      safe: safeChecks,
      unsafe: unsafeChecks,
      marginal: marginalChecks,
      safePercentage: totalChecks > 0 ? (safeChecks / totalChecks) * 100 : 0,
    };
  }),
});
