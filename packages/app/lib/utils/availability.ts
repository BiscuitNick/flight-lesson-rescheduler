/**
 * Availability Utilities
 * Functions for parsing, transforming, and working with instructor availability patterns
 */

import { parseISO, format, addDays, startOfDay, parse, isWithinInterval } from 'date-fns';

// ============================================================================
// TYPES
// ============================================================================

export interface TimeSlot {
  start: string; // HH:mm format
  end: string; // HH:mm format
}

export type DayOfWeek = 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN';

export interface WeeklySchedule {
  MON?: TimeSlot[];
  TUE?: TimeSlot[];
  WED?: TimeSlot[];
  THU?: TimeSlot[];
  FRI?: TimeSlot[];
  SAT?: TimeSlot[];
  SUN?: TimeSlot[];
}

export interface AvailabilityException {
  date: string; // YYYY-MM-DD format
  available: boolean;
  timeSlots?: TimeSlot[];
  reason?: string;
}

export interface InstructorAvailability {
  weeklySchedule: WeeklySchedule;
  exceptions: AvailabilityException[];
}

// ============================================================================
// DAY OF WEEK HELPERS
// ============================================================================

const DAY_INDEX_MAP: Record<number, DayOfWeek> = {
  0: 'SUN',
  1: 'MON',
  2: 'TUE',
  3: 'WED',
  4: 'THU',
  5: 'FRI',
  6: 'SAT',
};

const DAY_NAME_MAP: Record<DayOfWeek, string> = {
  MON: 'Monday',
  TUE: 'Tuesday',
  WED: 'Wednesday',
  THU: 'Thursday',
  FRI: 'Friday',
  SAT: 'Saturday',
  SUN: 'Sunday',
};

/**
 * Get day of week key from Date object
 */
export function getDayOfWeek(date: Date): DayOfWeek {
  return DAY_INDEX_MAP[date.getDay()];
}

/**
 * Get full day name from day key
 */
export function getDayName(day: DayOfWeek): string {
  return DAY_NAME_MAP[day];
}

/**
 * Get all days of week in order
 */
export function getAllDays(): DayOfWeek[] {
  return ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
}

// ============================================================================
// TIME SLOT HELPERS
// ============================================================================

/**
 * Format time slot for display (e.g., "9:00 AM - 5:00 PM")
 */
export function formatTimeSlot(slot: TimeSlot): string {
  return `${formatTimeString(slot.start)} - ${formatTimeString(slot.end)}`;
}

/**
 * Format HH:mm to 12-hour format (e.g., "09:00" → "9:00 AM")
 */
export function formatTimeString(time: string): string {
  const [hours, minutes] = time.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
}

/**
 * Convert time slot to minutes since midnight
 */
export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Check if a time falls within a time slot
 */
export function isTimeInSlot(time: string, slot: TimeSlot): boolean {
  const timeMinutes = timeToMinutes(time);
  const startMinutes = timeToMinutes(slot.start);
  const endMinutes = timeToMinutes(slot.end);

  return timeMinutes >= startMinutes && timeMinutes <= endMinutes;
}

/**
 * Check if two time slots overlap
 */
export function doSlotsOverlap(slot1: TimeSlot, slot2: TimeSlot): boolean {
  const start1 = timeToMinutes(slot1.start);
  const end1 = timeToMinutes(slot1.end);
  const start2 = timeToMinutes(slot2.start);
  const end2 = timeToMinutes(slot2.end);

  return start1 < end2 && end1 > start2;
}

/**
 * Merge overlapping time slots
 */
export function mergeTimeSlots(slots: TimeSlot[]): TimeSlot[] {
  if (slots.length === 0) return [];

  // Sort by start time
  const sorted = [...slots].sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));

  const merged: TimeSlot[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    const last = merged[merged.length - 1];

    if (doSlotsOverlap(current, last)) {
      // Merge overlapping slots
      last.end = minutesToTime(
        Math.max(timeToMinutes(last.end), timeToMinutes(current.end)),
      );
    } else {
      merged.push(current);
    }
  }

  return merged;
}

/**
 * Convert minutes since midnight to HH:mm format
 */
export function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

// ============================================================================
// AVAILABILITY CHECKING
// ============================================================================

/**
 * Get availability slots for a specific date
 * Considers weekly schedule and exceptions
 */
export function getAvailabilityForDate(
  date: Date,
  availability: InstructorAvailability,
): { available: boolean; slots: TimeSlot[]; reason?: string } {
  const dateStr = format(date, 'yyyy-MM-dd');

  // Check for exception first
  const exception = availability.exceptions.find((ex) => ex.date === dateStr);

  if (exception) {
    if (!exception.available) {
      return {
        available: false,
        slots: [],
        reason: exception.reason || 'Not available on this date',
      };
    }

    // Exception with custom time slots
    if (exception.timeSlots && exception.timeSlots.length > 0) {
      return {
        available: true,
        slots: exception.timeSlots,
      };
    }
  }

  // Fall back to weekly schedule
  const dayOfWeek = getDayOfWeek(date);
  const slots = availability.weeklySchedule[dayOfWeek] || [];

  if (slots.length === 0) {
    return {
      available: false,
      slots: [],
      reason: `Not available on ${getDayName(dayOfWeek)}s`,
    };
  }

  return {
    available: true,
    slots,
  };
}

/**
 * Check if instructor is available at a specific date/time
 */
export function isAvailableAt(
  dateTime: Date,
  duration: number, // in minutes
  availability: InstructorAvailability,
): { available: boolean; reason?: string } {
  const dayAvailability = getAvailabilityForDate(dateTime, availability);

  if (!dayAvailability.available) {
    return {
      available: false,
      reason: dayAvailability.reason,
    };
  }

  // Extract time from datetime
  const time = format(dateTime, 'HH:mm');
  const endTime = minutesToTime(
    dateTime.getHours() * 60 + dateTime.getMinutes() + duration,
  );

  // Check if the time window falls within any available slot
  for (const slot of dayAvailability.slots) {
    const slotStart = timeToMinutes(slot.start);
    const slotEnd = timeToMinutes(slot.end);
    const requestStart = timeToMinutes(time);
    const requestEnd = timeToMinutes(endTime);

    if (requestStart >= slotStart && requestEnd <= slotEnd) {
      return { available: true };
    }
  }

  return {
    available: false,
    reason: `Requested time ${formatTimeString(time)} - ${formatTimeString(endTime)} does not fall within available hours`,
  };
}

// ============================================================================
// AVAILABILITY FORMATTING
// ============================================================================

/**
 * Format weekly schedule as human-readable text
 */
export function formatWeeklySchedule(schedule: WeeklySchedule): string {
  const lines: string[] = [];

  getAllDays().forEach((day) => {
    const slots = schedule[day];
    if (slots && slots.length > 0) {
      const slotStrings = slots.map(formatTimeSlot).join(', ');
      lines.push(`${getDayName(day)}: ${slotStrings}`);
    }
  });

  return lines.length > 0 ? lines.join('\n') : 'No availability set';
}

/**
 * Get summary of weekly schedule (e.g., "Mon-Fri 9am-5pm")
 */
export function getWeeklyScheduleSummary(schedule: WeeklySchedule): string {
  // Simple summary - can be enhanced
  const workingDays = getAllDays().filter((day) => {
    const slots = schedule[day];
    return slots && slots.length > 0;
  });

  if (workingDays.length === 0) {
    return 'No availability';
  }

  if (workingDays.length === 7) {
    return 'Available 7 days/week';
  }

  if (workingDays.length === 5 && !workingDays.includes('SAT') && !workingDays.includes('SUN')) {
    return 'Available weekdays';
  }

  return `Available ${workingDays.length} day${workingDays.length > 1 ? 's' : ''}/week`;
}

/**
 * Format availability exception for display
 */
export function formatException(exception: AvailabilityException): string {
  const date = format(parseISO(exception.date), 'MMM d, yyyy');

  if (!exception.available) {
    return `${date}: ${exception.reason || 'Not available'}`;
  }

  if (exception.timeSlots && exception.timeSlots.length > 0) {
    const slots = exception.timeSlots.map(formatTimeSlot).join(', ');
    return `${date}: ${slots}${exception.reason ? ` (${exception.reason})` : ''}`;
  }

  return `${date}: Available${exception.reason ? ` (${exception.reason})` : ''}`;
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate time slot format and logic
 */
export function isValidTimeSlot(slot: TimeSlot): boolean {
  // Validate format (HH:mm)
  const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;

  if (!timeRegex.test(slot.start) || !timeRegex.test(slot.end)) {
    return false;
  }

  // Validate that end is after start
  return timeToMinutes(slot.end) > timeToMinutes(slot.start);
}

/**
 * Validate weekly schedule
 */
export function isValidWeeklySchedule(schedule: WeeklySchedule): boolean {
  for (const day of getAllDays()) {
    const slots = schedule[day];
    if (slots) {
      for (const slot of slots) {
        if (!isValidTimeSlot(slot)) {
          return false;
        }
      }
    }
  }
  return true;
}

/**
 * Validate availability exception
 */
export function isValidException(exception: AvailabilityException): boolean {
  // Validate date format
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(exception.date)) {
    return false;
  }

  // If custom time slots provided, validate them
  if (exception.timeSlots) {
    for (const slot of exception.timeSlots) {
      if (!isValidTimeSlot(slot)) {
        return false;
      }
    }
  }

  return true;
}

// ============================================================================
// CALENDAR INTEGRATION
// ============================================================================

/**
 * Generate calendar events from availability pattern for a date range
 * Useful for visualizing instructor availability on a calendar
 */
export function availabilityToCalendarSlots(
  availability: InstructorAvailability,
  startDate: Date,
  endDate: Date,
  instructorId: string,
  instructorName: string,
): Array<{
  id: string;
  title: string;
  start: Date;
  end: Date;
  resource: {
    instructorId: string;
    instructorName: string;
    type: 'availability';
  };
}> {
  const slots: Array<any> = [];
  let currentDate = startOfDay(startDate);

  while (currentDate <= endDate) {
    const dayAvailability = getAvailabilityForDate(currentDate, availability);

    if (dayAvailability.available) {
      dayAvailability.slots.forEach((slot, index) => {
        const [startHours, startMinutes] = slot.start.split(':').map(Number);
        const [endHours, endMinutes] = slot.end.split(':').map(Number);

        const start = new Date(currentDate);
        start.setHours(startHours, startMinutes, 0, 0);

        const end = new Date(currentDate);
        end.setHours(endHours, endMinutes, 0, 0);

        slots.push({
          id: `${instructorId}-${format(currentDate, 'yyyy-MM-dd')}-${index}`,
          title: `Available: ${formatTimeSlot(slot)}`,
          start,
          end,
          resource: {
            instructorId,
            instructorName,
            type: 'availability',
          },
        });
      });
    }

    currentDate = addDays(currentDate, 1);
  }

  return slots;
}
