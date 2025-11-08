/**
 * Booking Service
 * Business logic for booking operations with RBAC-aware filtering
 */

import { prisma } from '@/lib/server/db/prisma';
import type {
  Booking,
  BookingStatus,
  UserRole,
  WeatherCheck,
} from '@prisma/client';
import { TRPCError } from '@trpc/server';

// ============================================================================
// TYPES
// ============================================================================

export interface BookingWithRelations extends Booking {
  student: {
    id: string;
    email: string;
    name: string;
    trainingLevel: string | null;
  };
  instructor: {
    id: string;
    email: string;
    name: string;
  };
}

export interface CreateBookingInput {
  studentId: string;
  instructorId: string;
  departureLocation: string;
  arrivalLocation: string;
  scheduledStart: Date;
  scheduledEnd: Date;
  duration: number;
  flightType: string;
  notes?: string;
}

export interface UpdateBookingInput {
  departureLocation?: string;
  arrivalLocation?: string;
  scheduledStart?: Date;
  scheduledEnd?: Date;
  duration?: number;
  flightType?: string;
  notes?: string;
}

export interface ListBookingsFilters {
  userId: string;
  userRole: UserRole;
  status?: BookingStatus;
  startDate?: Date;
  endDate?: Date;
  studentId?: string;
  instructorId?: string;
}

// ============================================================================
// LIST BOOKINGS (with RBAC filtering)
// ============================================================================

/**
 * List bookings with role-based access control
 * - Students see only their own bookings
 * - Instructors see bookings they're assigned to
 * - Admins see all bookings
 */
export async function listBookings(
  filters: ListBookingsFilters,
): Promise<BookingWithRelations[]> {
  const { userId, userRole, status, startDate, endDate, studentId, instructorId } = filters;

  // Build where clause based on role
  const whereClause: any = {};

  // Role-based filtering
  if (userRole === 'STUDENT') {
    whereClause.studentId = userId;
  } else if (userRole === 'INSTRUCTOR') {
    whereClause.instructorId = userId;
  }
  // ADMIN sees all - no additional filter

  // Apply optional filters (only admins can filter by student/instructor)
  if (userRole === 'ADMIN') {
    if (studentId) whereClause.studentId = studentId;
    if (instructorId) whereClause.instructorId = instructorId;
  }

  // Status filter
  if (status) {
    whereClause.status = status;
  }

  // Date range filters
  if (startDate || endDate) {
    whereClause.scheduledStart = {};
    if (startDate) whereClause.scheduledStart.gte = startDate;
    if (endDate) whereClause.scheduledStart.lte = endDate;
  }

  return prisma.booking.findMany({
    where: whereClause,
    include: {
      student: {
        select: {
          id: true,
          email: true,
          name: true,
          trainingLevel: true,
        },
      },
      instructor: {
        select: {
          id: true,
          email: true,
          name: true,
        },
      },
    },
    orderBy: {
      scheduledStart: 'asc',
    },
  }) as Promise<BookingWithRelations[]>;
}

// ============================================================================
// GET BOOKING (with ownership check)
// ============================================================================

/**
 * Get a single booking by ID with RBAC checks
 * - Students can only view their own bookings
 * - Instructors can only view bookings they're assigned to
 * - Admins can view any booking
 */
export async function getBooking(
  bookingId: string,
  userId: string,
  userRole: UserRole,
): Promise<BookingWithRelations | null> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      student: {
        select: {
          id: true,
          email: true,
          name: true,
          trainingLevel: true,
        },
      },
      instructor: {
        select: {
          id: true,
          email: true,
          name: true,
        },
      },
    },
  });

  if (!booking) {
    return null;
  }

  // RBAC check
  if (userRole === 'STUDENT' && booking.studentId !== userId) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'You can only view your own bookings',
    });
  }

  if (userRole === 'INSTRUCTOR' && booking.instructorId !== userId) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'You can only view bookings you are assigned to',
    });
  }

  return booking as BookingWithRelations;
}

// ============================================================================
// CREATE BOOKING
// ============================================================================

/**
 * Create a new booking
 * Validates student/instructor existence and availability conflicts
 */
export async function createBooking(
  input: CreateBookingInput,
  userId: string,
  userRole: UserRole,
): Promise<Booking> {
  // Students can only create bookings for themselves
  if (userRole === 'STUDENT' && input.studentId !== userId) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Students can only create bookings for themselves',
    });
  }

  // Verify student exists and is a student
  const student = await prisma.user.findUnique({
    where: { id: input.studentId },
  });

  if (!student || student.role !== 'STUDENT') {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Invalid student ID',
    });
  }

  // Verify instructor exists and is an instructor
  const instructor = await prisma.user.findUnique({
    where: { id: input.instructorId },
  });

  if (!instructor || instructor.role !== 'INSTRUCTOR') {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Invalid instructor ID',
    });
  }

  // TODO: Check for scheduling conflicts (future enhancement)
  // - Instructor double-booking
  // - Student double-booking

  return prisma.booking.create({
    data: {
      ...input,
      status: 'SCHEDULED',
    },
  });
}

// ============================================================================
// UPDATE BOOKING
// ============================================================================

/**
 * Update booking details
 * Only instructors, admins, or the booking student can update
 */
export async function updateBooking(
  bookingId: string,
  input: UpdateBookingInput,
  userId: string,
  userRole: UserRole,
): Promise<Booking> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
  });

  if (!booking) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Booking not found',
    });
  }

  // RBAC check - students can only update their own, instructors their assigned
  if (userRole === 'STUDENT' && booking.studentId !== userId) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'You can only update your own bookings',
    });
  }

  if (userRole === 'INSTRUCTOR' && booking.instructorId !== userId) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'You can only update bookings you are assigned to',
    });
  }

  return prisma.booking.update({
    where: { id: bookingId },
    data: input,
  });
}

// ============================================================================
// UPDATE BOOKING STATUS
// ============================================================================

/**
 * Update booking status
 * Used for state transitions (e.g., SCHEDULED -> WEATHER_HOLD)
 */
export async function updateBookingStatus(
  bookingId: string,
  status: BookingStatus,
  userId: string,
  userRole: UserRole,
): Promise<Booking> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
  });

  if (!booking) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Booking not found',
    });
  }

  // RBAC check
  if (userRole === 'STUDENT' && booking.studentId !== userId) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'You can only update your own bookings',
    });
  }

  if (userRole === 'INSTRUCTOR' && booking.instructorId !== userId) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'You can only update bookings you are assigned to',
    });
  }

  return prisma.booking.update({
    where: { id: bookingId },
    data: { status },
  });
}

// ============================================================================
// DELETE BOOKING
// ============================================================================

/**
 * Delete (cancel) a booking
 * Students can cancel their own, instructors/admins can cancel assigned/all
 */
export async function deleteBooking(
  bookingId: string,
  userId: string,
  userRole: UserRole,
): Promise<void> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
  });

  if (!booking) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Booking not found',
    });
  }

  // RBAC check
  if (userRole === 'STUDENT' && booking.studentId !== userId) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'You can only cancel your own bookings',
    });
  }

  if (userRole === 'INSTRUCTOR' && booking.instructorId !== userId) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'You can only cancel bookings you are assigned to',
    });
  }

  // Soft delete by setting status to CANCELLED
  await prisma.booking.update({
    where: { id: bookingId },
    data: { status: 'CANCELLED' },
  });
}

// ============================================================================
// GET WEATHER HISTORY
// ============================================================================

/**
 * Get all weather checks for a booking
 * RBAC checks applied via booking ownership
 */
export async function getBookingWeatherHistory(
  bookingId: string,
  userId: string,
  userRole: UserRole,
): Promise<WeatherCheck[]> {
  // First verify user can access this booking
  const booking = await getBooking(bookingId, userId, userRole);

  if (!booking) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Booking not found',
    });
  }

  return prisma.weatherCheck.findMany({
    where: { bookingId },
    orderBy: { timestamp: 'desc' },
  });
}

// ============================================================================
// GET UPCOMING BOOKINGS
// ============================================================================

/**
 * Get upcoming bookings within a time window (for weather monitoring)
 * Admin-only function used by Lambda for weather checks
 */
export async function getUpcomingBookingsForWeatherCheck(
  hoursAhead: number = 48,
): Promise<Booking[]> {
  const now = new Date();
  const futureDate = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000);

  return prisma.booking.findMany({
    where: {
      scheduledStart: {
        gte: now,
        lte: futureDate,
      },
      status: {
        in: ['SCHEDULED', 'CONFIRMED'],
      },
    },
    include: {
      student: {
        select: {
          trainingLevel: true,
        },
      },
    },
  });
}
