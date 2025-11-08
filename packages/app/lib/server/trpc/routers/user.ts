/**
 * User router
 * Handles user-related queries and mutations
 */

import { z } from 'zod';
import { createTRPCRouter, protectedProcedure, publicProcedure } from '../init';
import { assertAdmin } from '../context';

export const userRouter = createTRPCRouter({
  /**
   * Get current authenticated user
   */
  me: protectedProcedure.query(async ({ ctx }) => {
    const user = await ctx.prisma.user.findUnique({
      where: { id: ctx.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        trainingLevel: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return user;
  }),

  /**
   * List all users (admin only)
   */
  list: protectedProcedure
    .input(
      z.object({
        role: z.enum(['STUDENT', 'INSTRUCTOR', 'ADMIN']).optional(),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      }),
    )
    .query(async ({ ctx, input }) => {
      assertAdmin(ctx.user);

      const users = await ctx.prisma.user.findMany({
        where: input.role ? { role: input.role } : undefined,
        take: input.limit,
        skip: input.offset,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          trainingLevel: true,
          createdAt: true,
        },
      });

      const total = await ctx.prisma.user.count({
        where: input.role ? { role: input.role } : undefined,
      });

      return {
        users,
        total,
        hasMore: input.offset + input.limit < total,
      };
    }),

  /**
   * Get user by ID
   */
  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      // Users can view their own profile, admins can view anyone
      if (ctx.user.role !== 'ADMIN' && ctx.user.id !== input.id) {
        throw new Error('Forbidden');
      }

      const user = await ctx.prisma.user.findUnique({
        where: { id: input.id },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          trainingLevel: true,
          availability: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return user;
    }),

  /**
   * Update user profile
   */
  updateProfile: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).optional(),
        trainingLevel: z
          .enum(['STUDENT_PILOT', 'PRIVATE_PILOT', 'INSTRUMENT_RATED'])
          .optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const updated = await ctx.prisma.user.update({
        where: { id: ctx.user.id },
        data: {
          ...(input.name && { name: input.name }),
          ...(input.trainingLevel && { trainingLevel: input.trainingLevel }),
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          trainingLevel: true,
        },
      });

      return updated;
    }),
});
