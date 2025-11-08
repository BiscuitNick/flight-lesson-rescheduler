/**
 * Prisma Client for Lambda
 * Simplified client for AWS Lambda environment
 */

import { PrismaClient } from '@prisma/client';

// Lambda-optimized Prisma configuration
const prismaClientOptions = {
  log: process.env.NODE_ENV === 'development'
    ? (['query', 'error', 'warn'] as const)
    : (['error'] as const),
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
};

/**
 * Create Prisma client for Lambda
 * Lambda containers are frozen between invocations, so we can reuse the client
 */
let prismaClient: PrismaClient | null = null;

export function getPrismaClient(): PrismaClient {
  if (!prismaClient) {
    prismaClient = new PrismaClient(prismaClientOptions);
  }
  return prismaClient;
}

/**
 * Disconnect Prisma client
 * Useful for cleanup in tests
 */
export async function disconnectPrisma(): Promise<void> {
  if (prismaClient) {
    await prismaClient.$disconnect();
    prismaClient = null;
  }
}
