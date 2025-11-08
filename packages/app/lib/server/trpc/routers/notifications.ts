/**
 * Notifications tRPC Router
 * Handles notification queries and mutations
 */

import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '../init';
import {
  getUserNotifications,
  markNotificationAsRead,
  markNotificationsAsRead,
  markAllNotificationsAsRead,
  getUnreadCount,
} from '../../services/notifications.service';

/**
 * Input validation schemas
 */
const getNotificationsSchema = z.object({
  limit: z.number().min(1).max(100).optional().default(50),
  offset: z.number().min(0).optional().default(0),
  unreadOnly: z.boolean().optional().default(false),
  type: z.enum(['WEATHER_ALERT', 'RESCHEDULE_SUGGESTION', 'CONFIRMATION', 'REMINDER', 'SYSTEM_MESSAGE']).optional(),
});

const markAsReadSchema = z.object({
  notificationId: z.string().uuid(),
});

const markMultipleAsReadSchema = z.object({
  notificationIds: z.array(z.string().uuid()),
});

/**
 * Notifications Router
 */
export const notificationsRouter = createTRPCRouter({
  /**
   * Get notifications for the authenticated user
   */
  list: protectedProcedure
    .input(getNotificationsSchema)
    .query(async ({ ctx, input }) => {
      const userId = ctx.user.id;

      const result = await getUserNotifications(userId, {
        limit: input.limit,
        offset: input.offset,
        unreadOnly: input.unreadOnly,
        type: input.type,
      });

      return result;
    }),

  /**
   * Get unread notification count
   */
  unreadCount: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.user.id;
    const count = await getUnreadCount(userId);

    return { count };
  }),

  /**
   * Mark a single notification as read
   */
  markAsRead: protectedProcedure
    .input(markAsReadSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id;
      const success = await markNotificationAsRead(input.notificationId, userId);

      if (!success) {
        throw new Error('Notification not found or unauthorized');
      }

      return { success: true };
    }),

  /**
   * Mark multiple notifications as read
   */
  markMultipleAsRead: protectedProcedure
    .input(markMultipleAsReadSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id;
      const count = await markNotificationsAsRead(input.notificationIds, userId);

      return { count };
    }),

  /**
   * Mark all notifications as read
   */
  markAllAsRead: protectedProcedure.mutation(async ({ ctx }) => {
    const userId = ctx.user.id;
    const count = await markAllNotificationsAsRead(userId);

    return { count };
  }),
});
