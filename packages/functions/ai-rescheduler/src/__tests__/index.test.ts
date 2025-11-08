import { describe, it, expect } from 'vitest';

describe('AI Rescheduler Lambda', () => {
  describe('Module structure', () => {
    it('should export handler function', async () => {
      const module = await import('../index');
      expect(module.handler).toBeDefined();
      expect(typeof module.handler).toBe('function');
    });
  });

  describe('Type definitions', () => {
    it('should have correct type exports', async () => {
      const types = await import('../types');
      expect(types).toBeDefined();
    });
  });

  describe('Prisma client', () => {
    it('should export Prisma utilities', async () => {
      const prisma = await import('../prisma');
      expect(prisma.getPrismaClient).toBeDefined();
      expect(prisma.disconnectPrisma).toBeDefined();
    });
  });
});
