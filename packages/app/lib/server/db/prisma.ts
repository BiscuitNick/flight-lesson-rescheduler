/**
 * Prisma Client Singleton
 *
 * This module provides a reusable Prisma client instance that:
 * - Prevents multiple instances in development (HMR issue)
 * - Supports connection pooling for production
 * - Works with Next.js API routes and Server Components
 * - Compatible with AWS Lambda (via Prisma Data Proxy or direct connection)
 *
 * Compatible with Prisma 5.x
 */

import { PrismaClient } from '@prisma/client';

// PrismaClient is attached to the `global` object in development to prevent
// exhausting your database connection limit.
// Learn more: https://pris.ly/d/help/next-js-best-practices

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * Prisma client configuration options
 * Optimized for both Next.js and AWS Lambda environments
 */
const prismaClientOptions = {
  log:
    process.env.NODE_ENV === 'development'
      ? (['query', 'error', 'warn'] as const)
      : (['error'] as const),

  // Connection pooling configuration
  // These settings work well for both Next.js and Lambda
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
};

/**
 * Global Prisma Client instance
 *
 * In development: reuses the same instance across hot reloads
 * In production: creates a new instance for each deployment
 */
export const prisma = globalForPrisma.prisma ?? new PrismaClient(prismaClientOptions);

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

/**
 * Gracefully disconnect Prisma Client on application shutdown
 * Useful for testing and ensuring clean shutdowns
 */
export async function disconnectPrisma() {
  await prisma.$disconnect();
}

/**
 * Type exports for convenience
 */
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
} from '@prisma/client';

/**
 * Utility function to check database connectivity
 * Useful for health checks in Lambda functions and API routes
 */
export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    console.error('Database connection check failed:', error);
    return false;
  }
}

/**
 * Transaction wrapper with automatic retry logic
 * Useful for handling transient database errors
 */
export async function withTransaction<T>(
  callback: (tx: PrismaClient) => Promise<T>,
  maxRetries = 3
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await prisma.$transaction(async (tx) => {
        return await callback(tx as PrismaClient);
      });
    } catch (error) {
      lastError = error as Error;

      // Only retry on transient errors
      if (
        error instanceof Error &&
        (error.message.includes('deadlock') ||
          error.message.includes('timeout') ||
          error.message.includes('connection'))
      ) {
        if (attempt < maxRetries) {
          // Exponential backoff
          await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 100));
          continue;
        }
      }

      // For non-transient errors or final attempt, throw immediately
      throw error;
    }
  }

  throw lastError;
}

/**
 * Batch operation helper
 * Useful for seeding or bulk operations with progress tracking
 */
export async function batchOperation<T, R>(
  items: T[],
  operation: (item: T) => Promise<R>,
  batchSize = 100,
  onProgress?: (completed: number, total: number) => void
): Promise<R[]> {
  const results: R[] = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(operation));
    results.push(...batchResults);

    if (onProgress) {
      onProgress(Math.min(i + batchSize, items.length), items.length);
    }
  }

  return results;
}

/**
 * Default export for convenience
 */
export default prisma;
