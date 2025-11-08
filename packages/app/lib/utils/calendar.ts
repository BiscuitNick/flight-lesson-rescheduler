/**
 * Calendar Utilities
 * Shared functions for calendar operations and event transformations
 */

import type { Booking, BookingStatus } from '@prisma/client';
import { format, parseISO, addMinutes, isSameDay, startOfDay, endOfDay } from 'date-fns';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Calendar event representation
 * Compatible with common calendar libraries (react-big-calendar, FullCalendar, etc.)
 */
export interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  allDay?: boolean;
  resource?: any;
}

/**
 * Booking calendar event with additional metadata
 */
export interface BookingCalendarEvent extends CalendarEvent {
  resource: {
    bookingId: string;
    studentName: string;
    instructorName: string;
    status: BookingStatus;
    flightType: string;
    departureLocation: string;
    arrivalLocation: string;
    notes?: string;
  };
}

/**
 * Availability slot for calendar visualization
 */
export interface AvailabilitySlot {
  id: string;
  start: Date;
  end: Date;
  instructorId: string;
  instructorName: string;
  isAvailable: boolean;
  reason?: string; // e.g., "Day off", "Booked"
}

// ============================================================================
// BOOKING TO CALENDAR EVENT CONVERSION
// ============================================================================

/**
 * Convert a booking to a calendar event
 */
export function bookingToCalendarEvent(
  booking: Booking & {
    student: { name: string };
    instructor: { name: string };
  },
): BookingCalendarEvent {
  return {
    id: booking.id,
    title: `${booking.student.name} - ${booking.flightType}`,
    start: booking.scheduledStart,
    end: booking.scheduledEnd,
    allDay: false,
    resource: {
      bookingId: booking.id,
      studentName: booking.student.name,
      instructorName: booking.instructor.name,
      status: booking.status,
      flightType: booking.flightType,
      departureLocation: booking.departureLocation,
      arrivalLocation: booking.arrivalLocation,
      notes: booking.notes || undefined,
    },
  };
}

/**
 * Convert array of bookings to calendar events
 */
export function bookingsToCalendarEvents(
  bookings: (Booking & {
    student: { name: string };
    instructor: { name: string };
  })[],
): BookingCalendarEvent[] {
  return bookings.map(bookingToCalendarEvent);
}

// ============================================================================
// STATUS HELPERS
// ============================================================================

/**
 * Get CSS class name for booking status
 * Useful for styling calendar events
 */
export function getBookingStatusClassName(status: BookingStatus): string {
  const statusMap: Record<BookingStatus, string> = {
    SCHEDULED: 'status-scheduled',
    WEATHER_HOLD: 'status-weather-hold',
    AWAITING_RESPONSE: 'status-awaiting-response',
    CONFIRMED: 'status-confirmed',
    CANCELLED: 'status-cancelled',
    COMPLETED: 'status-completed',
  };

  return statusMap[status] || 'status-default';
}

/**
 * Get color for booking status
 * Returns hex color code for visual representation
 */
export function getBookingStatusColor(status: BookingStatus): string {
  const colorMap: Record<BookingStatus, string> = {
    SCHEDULED: '#3b82f6', // blue
    WEATHER_HOLD: '#eab308', // yellow
    AWAITING_RESPONSE: '#f59e0b', // amber
    CONFIRMED: '#10b981', // green
    CANCELLED: '#ef4444', // red
    COMPLETED: '#6b7280', // gray
  };

  return colorMap[status] || '#9ca3af';
}

/**
 * Get display label for booking status
 */
export function getBookingStatusLabel(status: BookingStatus): string {
  const labelMap: Record<BookingStatus, string> = {
    SCHEDULED: 'Scheduled',
    WEATHER_HOLD: 'Weather Hold',
    AWAITING_RESPONSE: 'Awaiting Response',
    CONFIRMED: 'Confirmed',
    CANCELLED: 'Cancelled',
    COMPLETED: 'Completed',
  };

  return labelMap[status] || status;
}

// ============================================================================
// TIME FORMATTING
// ============================================================================

/**
 * Format time for display (e.g., "9:00 AM")
 */
export function formatTime(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'h:mm a');
}

/**
 * Format date and time for display (e.g., "Jan 15, 2024 9:00 AM")
 */
export function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'MMM d, yyyy h:mm a');
}

/**
 * Format date for display (e.g., "Jan 15, 2024")
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'MMM d, yyyy');
}

/**
 * Format duration in minutes to human-readable string (e.g., "2 hours 30 minutes")
 */
export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (hours === 0) {
    return `${mins} minute${mins !== 1 ? 's' : ''}`;
  }

  if (mins === 0) {
    return `${hours} hour${hours !== 1 ? 's' : ''}`;
  }

  return `${hours} hour${hours !== 1 ? 's' : ''} ${mins} minute${mins !== 1 ? 's' : ''}`;
}

/**
 * Get duration between two dates in minutes
 */
export function getDurationMinutes(start: Date, end: Date): number {
  return Math.round((end.getTime() - start.getTime()) / (1000 * 60));
}

// ============================================================================
// FLIGHT ROUTE FORMATTING
// ============================================================================

/**
 * Format flight route for display (e.g., "KPAO → KSQL")
 */
export function formatFlightRoute(departure: string, arrival: string): string {
  if (departure === arrival) {
    return `${departure} (Local)`;
  }
  return `${departure} → ${arrival}`;
}

/**
 * Check if booking is a local flight
 */
export function isLocalFlight(departure: string, arrival: string): boolean {
  return departure === arrival;
}

// ============================================================================
// DATE RANGE HELPERS
// ============================================================================

/**
 * Check if a booking falls within a date range
 */
export function isBookingInRange(
  booking: Pick<Booking, 'scheduledStart' | 'scheduledEnd'>,
  rangeStart: Date,
  rangeEnd: Date,
): boolean {
  return booking.scheduledStart >= rangeStart && booking.scheduledEnd <= rangeEnd;
}

/**
 * Filter bookings by date range
 */
export function filterBookingsByDateRange<T extends Pick<Booking, 'scheduledStart' | 'scheduledEnd'>>(
  bookings: T[],
  rangeStart: Date,
  rangeEnd: Date,
): T[] {
  return bookings.filter((booking) => isBookingInRange(booking, rangeStart, rangeEnd));
}

/**
 * Group bookings by date
 */
export function groupBookingsByDate<T extends Pick<Booking, 'scheduledStart'>>(
  bookings: T[],
): Map<string, T[]> {
  const grouped = new Map<string, T[]>();

  bookings.forEach((booking) => {
    const dateKey = format(booking.scheduledStart, 'yyyy-MM-dd');
    const existing = grouped.get(dateKey) || [];
    grouped.set(dateKey, [...existing, booking]);
  });

  return grouped;
}

// ============================================================================
// CALENDAR VIEW HELPERS
// ============================================================================

/**
 * Get calendar view bounds (start and end dates for a month view)
 */
export function getMonthViewBounds(date: Date): { start: Date; end: Date } {
  const start = startOfDay(new Date(date.getFullYear(), date.getMonth(), 1));
  const end = endOfDay(new Date(date.getFullYear(), date.getMonth() + 1, 0));

  return { start, end };
}

/**
 * Get calendar view bounds for a week view
 */
export function getWeekViewBounds(date: Date): { start: Date; end: Date } {
  const dayOfWeek = date.getDay();
  const start = startOfDay(new Date(date));
  start.setDate(date.getDate() - dayOfWeek); // Sunday

  const end = endOfDay(new Date(start));
  end.setDate(start.getDate() + 6); // Saturday

  return { start, end };
}

/**
 * Get calendar view bounds for a day view
 */
export function getDayViewBounds(date: Date): { start: Date; end: Date } {
  return {
    start: startOfDay(date),
    end: endOfDay(date),
  };
}
