/**
 * Type definitions for AI Rescheduler Lambda
 */

/**
 * Payload structure from Weather Monitor Lambda (via SQS)
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

/**
 * Single reschedule suggestion from AI
 */
export interface RescheduleOption {
  proposedDateTime: Date;
  reasoning: string;
  confidence: number; // 0.0 to 1.0
  weatherSafe: boolean;
  instructorAvailable: boolean;
}

/**
 * AI response schema
 */
export interface AIRescheduleResponse {
  suggestions: Array<{
    dateTime: string; // ISO date string
    reasoning: string;
    confidence: number;
  }>;
}

/**
 * Context for AI prompt generation
 */
export interface RescheduleContext {
  booking: {
    id: string;
    studentId: string;
    instructorId: string;
    departureLocation: string;
    arrivalLocation: string;
    scheduledStart: Date;
    scheduledEnd: Date;
    duration: number;
    trainingLevel: string;
  };
  violations: string[];
  instructorAvailability: unknown; // JSON availability pattern
  weatherForecast?: unknown; // Optional weather forecast data
}

/**
 * SNS notification payload
 */
export interface RescheduleNotificationPayload {
  bookingId: string;
  studentId: string;
  instructorId: string;
  originalDateTime: string;
  suggestionsCount: number;
  triggeredAt: string;
}
