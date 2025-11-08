/**
 * Tests for Prisma Client Helper
 *
 * These tests validate:
 * - Singleton pattern works correctly
 * - Connection health checks function properly
 * - Transaction wrapper handles retries
 * - Batch operations process correctly
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PrismaClient } from '@prisma/client';

// Mock Prisma Client
vi.mock('@prisma/client', () => {
  const mockPrismaClient = {
    $disconnect: vi.fn(),
    $queryRaw: vi.fn(),
    $transaction: vi.fn(),
  };

  return {
    PrismaClient: vi.fn(() => mockPrismaClient),
  };
});

describe('Prisma Client Helper', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks();
    // Clear the module cache to test singleton behavior
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Singleton Pattern', () => {
    it('should create only one instance in development', async () => {
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      // Import module twice
      const { prisma: prisma1 } = await import('./prisma');
      const { prisma: prisma2 } = await import('./prisma');

      // Should be the same instance
      expect(prisma1).toBe(prisma2);

      process.env.NODE_ENV = originalNodeEnv;
    });

    it('should export PrismaClient instance', async () => {
      const { prisma } = await import('./prisma');
      expect(prisma).toBeDefined();
      expect(typeof prisma.$disconnect).toBe('function');
    });
  });

  describe('checkDatabaseConnection', () => {
    it('should return true when connection is successful', async () => {
      const { checkDatabaseConnection, prisma } = await import('./prisma');

      // Mock successful query
      vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([{ '?column?': 1 }]);

      const result = await checkDatabaseConnection();

      expect(result).toBe(true);
      expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    });

    it('should return false when connection fails', async () => {
      const { checkDatabaseConnection, prisma } = await import('./prisma');

      // Mock failed query
      vi.mocked(prisma.$queryRaw).mockRejectedValueOnce(new Error('Connection failed'));

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const result = await checkDatabaseConnection();

      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('withTransaction', () => {
    it('should execute transaction successfully', async () => {
      const { withTransaction, prisma } = await import('./prisma');

      const mockCallback = vi.fn().mockResolvedValue('success');

      // Mock successful transaction
      vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
        return await callback(prisma);
      });

      const result = await withTransaction(mockCallback);

      expect(result).toBe('success');
      expect(mockCallback).toHaveBeenCalledTimes(1);
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('should retry on transient errors', async () => {
      const { withTransaction, prisma } = await import('./prisma');

      let attemptCount = 0;
      const mockCallback = vi.fn().mockImplementation(() => {
        attemptCount++;
        if (attemptCount < 3) {
          throw new Error('deadlock detected');
        }
        return Promise.resolve('success after retries');
      });

      // Mock transaction that calls callback
      vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
        return await callback(prisma);
      });

      const result = await withTransaction(mockCallback, 3);

      expect(result).toBe('success after retries');
      expect(mockCallback).toHaveBeenCalledTimes(3);
    });

    it('should not retry on non-transient errors', async () => {
      const { withTransaction, prisma } = await import('./prisma');

      const mockCallback = vi.fn().mockRejectedValue(new Error('validation error'));

      vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
        return await callback(prisma);
      });

      await expect(withTransaction(mockCallback, 3)).rejects.toThrow('validation error');
      expect(mockCallback).toHaveBeenCalledTimes(1);
    });

    it('should throw after max retries exceeded', async () => {
      const { withTransaction, prisma } = await import('./prisma');

      const mockCallback = vi.fn().mockRejectedValue(new Error('connection timeout'));

      vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
        return await callback(prisma);
      });

      await expect(withTransaction(mockCallback, 2)).rejects.toThrow('connection timeout');
      expect(mockCallback).toHaveBeenCalledTimes(2);
    });
  });

  describe('batchOperation', () => {
    it('should process all items in batches', async () => {
      const { batchOperation } = await import('./prisma');

      const items = Array.from({ length: 250 }, (_, i) => i);
      const operation = vi.fn().mockImplementation((item: number) => Promise.resolve(item * 2));

      const results = await batchOperation(items, operation, 100);

      expect(results).toHaveLength(250);
      expect(results[0]).toBe(0);
      expect(results[249]).toBe(498);
      expect(operation).toHaveBeenCalledTimes(250);
    });

    it('should call progress callback', async () => {
      const { batchOperation } = await import('./prisma');

      const items = Array.from({ length: 150 }, (_, i) => i);
      const operation = vi.fn().mockImplementation((item: number) => Promise.resolve(item));
      const onProgress = vi.fn();

      await batchOperation(items, operation, 50, onProgress);

      expect(onProgress).toHaveBeenCalledTimes(3);
      expect(onProgress).toHaveBeenNthCalledWith(1, 50, 150);
      expect(onProgress).toHaveBeenNthCalledWith(2, 100, 150);
      expect(onProgress).toHaveBeenNthCalledWith(3, 150, 150);
    });

    it('should handle empty array', async () => {
      const { batchOperation } = await import('./prisma');

      const operation = vi.fn();
      const results = await batchOperation([], operation, 100);

      expect(results).toHaveLength(0);
      expect(operation).not.toHaveBeenCalled();
    });

    it('should handle errors in batch operations', async () => {
      const { batchOperation } = await import('./prisma');

      const items = [1, 2, 3];
      const operation = vi.fn().mockImplementation((item: number) => {
        if (item === 2) {
          return Promise.reject(new Error('Operation failed'));
        }
        return Promise.resolve(item);
      });

      await expect(batchOperation(items, operation, 10)).rejects.toThrow('Operation failed');
    });
  });

  describe('disconnectPrisma', () => {
    it('should call $disconnect on prisma client', async () => {
      const { disconnectPrisma, prisma } = await import('./prisma');

      vi.mocked(prisma.$disconnect).mockResolvedValueOnce(undefined);

      await disconnectPrisma();

      expect(prisma.$disconnect).toHaveBeenCalledTimes(1);
    });
  });

  describe('Type Exports', () => {
    it('should export Prisma types', async () => {
      const exports = await import('./prisma');

      // Check that the module exports the expected items
      expect(exports.prisma).toBeDefined();
      expect(exports.checkDatabaseConnection).toBeDefined();
      expect(exports.withTransaction).toBeDefined();
      expect(exports.batchOperation).toBeDefined();
      expect(exports.disconnectPrisma).toBeDefined();
      expect(exports.default).toBeDefined();
    });
  });
});
