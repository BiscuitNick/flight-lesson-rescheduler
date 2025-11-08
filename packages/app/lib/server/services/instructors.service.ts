/**
 * Instructor Service
 * Business logic for instructor availability and scheduling
 */

import { prisma } from '@/lib/server/db/prisma';
import type { User, UserRole, Booking } from '@prisma/client';
import { TRPCError } from '@trpc/server';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Weekly availability schedule
 * Days of week mapped to time slots
 */
export interface WeeklySchedule {
  MON?: TimeSlot[];
  TUE?: TimeSlot[];
  WED?: TimeSlot[];
  THU?: TimeSlot[];
  FRI?: TimeSlot[];
  SAT?: TimeSlot[];
  SUN?: TimeSlot[];
}

export interface TimeSlot {
  start: string; // HH:mm format (e.g., "09:00")
  end: string; // HH:mm format (e.g., "17:00")
}

/**
 * Availability exceptions for specific dates
 */
export interface AvailabilityException {
  date: string; // ISO date string (e.g., "2024-12-25")
  available: boolean; // false for days off, true for special availability
  timeSlots?: TimeSlot[]; // If available=true, custom slots for this date
  reason?: string; // Optional note (e.g., "Holiday", "Conference")
}

/**
 * Complete availability pattern stored in JSONB
 */
export interface InstructorAvailability {
  weeklySchedule: WeeklySchedule;
  exceptions: AvailabilityException[];
}

export interface InstructorWithAvailability extends User {
  availability: InstructorAvailability | null;
}

export interface UpdateAvailabilityInput {
  weeklySchedule?: WeeklySchedule;
  exceptions?: AvailabilityException[];
}

// ============================================================================
// LIST INSTRUCTORS
// ============================================================================

/**
 * Get all instructors (for booking creation UI)
 * Returns basic info + availability status
 */
export async function listInstructors(): Promise<InstructorWithAvailability[]> {
  return prisma.user.findMany({
    where: { role: 'INSTRUCTOR' },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      trainingLevel: true,
      availability: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { name: 'asc' },
  }) as Promise<InstructorWithAvailability[]>;
}

// ============================================================================
// GET INSTRUCTOR AVAILABILITY
// ============================================================================

/**
 * Get availability pattern for a specific instructor
 */
export async function getInstructorAvailability(
  instructorId: string,
): Promise<InstructorAvailability | null> {
  const instructor = await prisma.user.findUnique({
    where: { id: instructorId },
    select: {
      role: true,
      availability: true,
    },
  });

  if (!instructor) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Instructor not found',
    });
  }

  if (instructor.role !== 'INSTRUCTOR') {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'User is not an instructor',
    });
  }

  return instructor.availability as InstructorAvailability | null;
}

// ============================================================================
// UPDATE INSTRUCTOR AVAILABILITY
// ============================================================================

/**
 * Update instructor availability pattern
 * Only the instructor themselves or admins can update
 */
export async function updateInstructorAvailability(
  instructorId: string,
  input: UpdateAvailabilityInput,
  userId: string,
  userRole: UserRole,
): Promise<InstructorAvailability> {
  // RBAC check - only the instructor or admin can update
  if (userRole !== 'ADMIN' && userId !== instructorId) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'You can only update your own availability',
    });
  }

  const instructor = await prisma.user.findUnique({
    where: { id: instructorId },
    select: {
      role: true,
      availability: true,
    },
  });

  if (!instructor) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Instructor not found',
    });
  }

  if (instructor.role !== 'INSTRUCTOR') {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'User is not an instructor',
    });
  }

  // Merge with existing availability
  const currentAvailability = (instructor.availability as InstructorAvailability) || {
    weeklySchedule: {},
    exceptions: [],
  };

  const updatedAvailability: InstructorAvailability = {
    weeklySchedule: input.weeklySchedule || currentAvailability.weeklySchedule,
    exceptions: input.exceptions || currentAvailability.exceptions,
  };

  // Validate time slots format
  validateAvailability(updatedAvailability);

  await prisma.user.update({
    where: { id: instructorId },
    data: {
      availability: updatedAvailability as any,
    },
  });

  return updatedAvailability;
}

// ============================================================================
// ADD AVAILABILITY EXCEPTION
// ============================================================================

/**
 * Add a single availability exception (day off, special hours)
 * Useful for adding individual exceptions without replacing the whole array
 */
export async function addAvailabilityException(
  instructorId: string,
  exception: AvailabilityException,
  userId: string,
  userRole: UserRole,
): Promise<InstructorAvailability> {
  // RBAC check
  if (userRole !== 'ADMIN' && userId !== instructorId) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'You can only update your own availability',
    });
  }

  const instructor = await prisma.user.findUnique({
    where: { id: instructorId },
    select: {
      role: true,
      availability: true,
    },
  });

  if (!instructor || instructor.role !== 'INSTRUCTOR') {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Instructor not found',
    });
  }

  const currentAvailability = (instructor.availability as InstructorAvailability) || {
    weeklySchedule: {},
    exceptions: [],
  };

  // Remove any existing exception for this date, then add the new one
  const filteredExceptions = currentAvailability.exceptions.filter(
    (ex) => ex.date !== exception.date,
  );

  const updatedAvailability: InstructorAvailability = {
    ...currentAvailability,
    exceptions: [...filteredExceptions, exception],
  };

  await prisma.user.update({
    where: { id: instructorId },
    data: {
      availability: updatedAvailability as any,
    },
  });

  return updatedAvailability;
}

// ============================================================================
// REMOVE AVAILABILITY EXCEPTION
// ============================================================================

/**
 * Remove an availability exception by date
 */
export async function removeAvailabilityException(
  instructorId: string,
  date: string,
  userId: string,
  userRole: UserRole,
): Promise<InstructorAvailability> {
  // RBAC check
  if (userRole !== 'ADMIN' && userId !== instructorId) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'You can only update your own availability',
    });
  }

  const instructor = await prisma.user.findUnique({
    where: { id: instructorId },
    select: {
      role: true,
      availability: true,
    },
  });

  if (!instructor || instructor.role !== 'INSTRUCTOR') {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Instructor not found',
    });
  }

  const currentAvailability = (instructor.availability as InstructorAvailability) || {
    weeklySchedule: {},
    exceptions: [],
  };

  const updatedAvailability: InstructorAvailability = {
    ...currentAvailability,
    exceptions: currentAvailability.exceptions.filter((ex) => ex.date !== date),
  };

  await prisma.user.update({
    where: { id: instructorId },
    data: {
      availability: updatedAvailability as any,
    },
  });

  return updatedAvailability;
}

// ============================================================================
// GET INSTRUCTOR BOOKINGS
// ============================================================================

/**
 * Get all bookings for an instructor within a date range
 * Useful for availability checking and schedule visualization
 */
export async function getInstructorBookings(
  instructorId: string,
  startDate?: Date,
  endDate?: Date,
  userId?: string,
  userRole?: UserRole,
): Promise<Booking[]> {
  // RBAC check - instructor can see their own, admins can see all
  if (userId && userRole) {
    if (userRole !== 'ADMIN' && userId !== instructorId) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'You can only view your own bookings',
      });
    }
  }

  const whereClause: any = {
    instructorId,
  };

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
          name: true,
          email: true,
          trainingLevel: true,
        },
      },
    },
    orderBy: { scheduledStart: 'asc' },
  });
}

// ============================================================================
// CHECK AVAILABILITY
// ============================================================================

/**
 * Check if instructor is available at a specific date/time
 * Considers weekly schedule, exceptions, and existing bookings
 */
export async function checkInstructorAvailability(
  instructorId: string,
  requestedStart: Date,
  requestedEnd: Date,
): Promise<{
  available: boolean;
  reason?: string;
}> {
  // Get availability pattern
  const availability = await getInstructorAvailability(instructorId);

  if (!availability) {
    return {
      available: false,
      reason: 'Instructor has not set availability schedule',
    };
  }

  // Check for date-specific exception
  const dateStr = requestedStart.toISOString().split('T')[0];
  const exception = availability.exceptions.find((ex) => ex.date === dateStr);

  if (exception) {
    if (!exception.available) {
      return {
        available: false,
        reason: exception.reason || 'Instructor is unavailable on this date',
      };
    }
    // TODO: Check time slots if exception provides custom hours
  }

  // Check weekly schedule
  const dayOfWeek = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][
    requestedStart.getDay()
  ] as keyof WeeklySchedule;

  const daySlots = availability.weeklySchedule[dayOfWeek];

  if (!daySlots || daySlots.length === 0) {
    return {
      available: false,
      reason: `Instructor does not work on ${dayOfWeek}`,
    };
  }

  // TODO: Check if requested time falls within available slots
  // For now, just check if there are slots for that day

  // Check for conflicting bookings
  const conflictingBookings = await prisma.booking.findMany({
    where: {
      instructorId,
      status: {
        in: ['SCHEDULED', 'CONFIRMED'],
      },
      OR: [
        {
          // Requested start falls within existing booking
          AND: [
            { scheduledStart: { lte: requestedStart } },
            { scheduledEnd: { gt: requestedStart } },
          ],
        },
        {
          // Requested end falls within existing booking
          AND: [
            { scheduledStart: { lt: requestedEnd } },
            { scheduledEnd: { gte: requestedEnd } },
          ],
        },
        {
          // Requested booking completely contains existing booking
          AND: [
            { scheduledStart: { gte: requestedStart } },
            { scheduledEnd: { lte: requestedEnd } },
          ],
        },
      ],
    },
  });

  if (conflictingBookings.length > 0) {
    return {
      available: false,
      reason: 'Instructor has a conflicting booking at this time',
    };
  }

  return { available: true };
}

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Validate availability data structure
 */
function validateAvailability(availability: InstructorAvailability): void {
  // Validate time format in weekly schedule
  if (availability.weeklySchedule) {
    Object.entries(availability.weeklySchedule).forEach(([day, slots]) => {
      if (slots) {
        slots.forEach((slot) => {
          if (!isValidTimeFormat(slot.start) || !isValidTimeFormat(slot.end)) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: `Invalid time format in ${day} schedule. Use HH:mm format (e.g., "09:00")`,
            });
          }
        });
      }
    });
  }

  // Validate exception dates
  if (availability.exceptions) {
    availability.exceptions.forEach((exception) => {
      if (!isValidDateFormat(exception.date)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Invalid date format in exception. Use YYYY-MM-DD format',
        });
      }

      if (exception.timeSlots) {
        exception.timeSlots.forEach((slot) => {
          if (!isValidTimeFormat(slot.start) || !isValidTimeFormat(slot.end)) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'Invalid time format in exception time slots',
            });
          }
        });
      }
    });
  }
}

/**
 * Check if time string is in HH:mm format
 */
function isValidTimeFormat(time: string): boolean {
  return /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(time);
}

/**
 * Check if date string is in YYYY-MM-DD format
 */
function isValidDateFormat(date: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(date);
}
