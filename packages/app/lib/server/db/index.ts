/**
 * Database Module Index
 *
 * Exports all database-related utilities for easy importing
 */

export {
  prisma,
  checkDatabaseConnection,
  withTransaction,
  batchOperation,
  disconnectPrisma,
  default,
} from './prisma';

export type {
  User,
  Booking,
  WeatherCheck,
  RescheduleLog,
  Notification,
  WeatherMinimum,
  UserRole,
  TrainingLevel,
  BookingStatus,
  WeatherStatus,
  NotificationType,
  NotificationChannel,
} from './prisma';
