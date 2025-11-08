/**
 * Type definitions for Weather Monitor Lambda
 */

export interface WeatherConflictPayload {
  bookingId: string;
  studentId: string;
  instructorId: string;
  scheduledStart: string; // ISO date string
  scheduledEnd: string; // ISO date string
  departureLocation: string;
  arrivalLocation: string;
  trainingLevel: string;
  violationSummary: string[];
  overallStatus: 'SAFE' | 'MARGINAL' | 'UNSAFE';
  checkedAt: string; // ISO date string
}

export interface WeatherCheckResult {
  bookingId: string;
  hasConflict: boolean;
  overallStatus: 'SAFE' | 'MARGINAL' | 'UNSAFE';
  violationReasons: string[];
  waypointData: unknown; // JSON data
}
