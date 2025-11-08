import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Re-export calendar utilities for convenience
export {
  formatDateTime,
  formatDate,
  formatTime,
  formatDuration,
  formatFlightRoute,
  getBookingStatusLabel,
  getBookingStatusColor,
  getBookingStatusClassName,
  bookingToCalendarEvent,
  bookingsToCalendarEvents,
  isLocalFlight,
  getDurationMinutes,
  isBookingInRange,
  filterBookingsByDateRange,
  groupBookingsByDate,
  getMonthViewBounds,
  getWeekViewBounds,
  getDayViewBounds,
} from './utils/calendar';
