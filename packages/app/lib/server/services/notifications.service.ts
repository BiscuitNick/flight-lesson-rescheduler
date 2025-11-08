/**
 * Notifications Service
 * Business logic for managing notifications, SNS event handling, and SES email delivery
 */

import { getPrismaClient } from '../db/prisma';
import type { NotificationType, NotificationChannel, Prisma } from '@prisma/client';

const prisma = getPrismaClient();

export interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  channel: NotificationChannel;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
}

export interface SNSNotificationPayload {
  bookingId: string;
  studentId: string;
  instructorId: string;
  eventType: 'WEATHER_ALERT' | 'RESCHEDULE_SUGGESTIONS' | 'CONFIRMATION';
  originalDateTime?: string;
  suggestionsCount?: number;
  triggeredAt: string;
}

/**
 * Create a new notification record
 */
export async function createNotification(input: CreateNotificationInput) {
  const notification = await prisma.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      channel: input.channel,
      title: input.title,
      message: input.message,
      metadata: input.metadata || {},
      deliveredAt: new Date(), // Mark as delivered immediately for in-app
    },
  });

  return notification;
}

/**
 * Create multiple notifications at once (batch)
 */
export async function createNotifications(inputs: CreateNotificationInput[]) {
  const notifications = await prisma.notification.createMany({
    data: inputs.map((input) => ({
      userId: input.userId,
      type: input.type,
      channel: input.channel,
      title: input.title,
      message: input.message,
      metadata: (input.metadata || {}) as Prisma.JsonObject,
      deliveredAt: new Date(),
    })),
  });

  return notifications;
}

/**
 * Handle SNS notification payload and create appropriate notification records
 */
export async function handleSNSNotification(payload: SNSNotificationPayload) {
  const { bookingId, studentId, instructorId, eventType } = payload;

  // Fetch booking details for context
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      student: true,
      instructor: true,
    },
  });

  if (!booking) {
    throw new Error(`Booking ${bookingId} not found`);
  }

  const notifications: CreateNotificationInput[] = [];

  // Create notifications based on event type
  switch (eventType) {
    case 'WEATHER_ALERT':
      // Notify both student and instructor about weather hold
      notifications.push({
        userId: studentId,
        type: 'WEATHER_ALERT',
        channel: 'IN_APP',
        title: 'Weather Hold - Lesson Rescheduling Required',
        message: `Your flight lesson scheduled for ${booking.scheduledStart.toLocaleString()} has been placed on weather hold due to unsafe conditions. You will receive reschedule suggestions shortly.`,
        metadata: { bookingId, eventType },
      });

      notifications.push({
        userId: instructorId,
        type: 'WEATHER_ALERT',
        channel: 'IN_APP',
        title: 'Weather Hold - Student Lesson Affected',
        message: `The flight lesson with ${booking.student.name} scheduled for ${booking.scheduledStart.toLocaleString()} has been placed on weather hold.`,
        metadata: { bookingId, eventType, studentName: booking.student.name },
      });
      break;

    case 'RESCHEDULE_SUGGESTIONS':
      // Notify student about available reschedule suggestions
      notifications.push({
        userId: studentId,
        type: 'RESCHEDULE_SUGGESTION',
        channel: 'IN_APP',
        title: 'Reschedule Suggestions Available',
        message: `We've generated ${payload.suggestionsCount || 0} alternative time slots for your flight lesson. Please review and select your preferred option.`,
        metadata: { bookingId, eventType, suggestionsCount: payload.suggestionsCount },
      });

      // Notify instructor for awareness
      notifications.push({
        userId: instructorId,
        type: 'RESCHEDULE_SUGGESTION',
        channel: 'IN_APP',
        title: 'Reschedule Suggestions Sent',
        message: `${payload.suggestionsCount || 0} reschedule suggestions have been sent to ${booking.student.name} for the lesson originally scheduled on ${payload.originalDateTime}.`,
        metadata: { bookingId, eventType, studentName: booking.student.name },
      });
      break;

    case 'CONFIRMATION':
      // Notify both parties about confirmed reschedule
      notifications.push({
        userId: studentId,
        type: 'CONFIRMATION',
        channel: 'IN_APP',
        title: 'Lesson Rescheduled Successfully',
        message: `Your flight lesson has been rescheduled. New time: ${booking.scheduledStart.toLocaleString()}`,
        metadata: { bookingId, eventType },
      });

      notifications.push({
        userId: instructorId,
        type: 'CONFIRMATION',
        channel: 'IN_APP',
        title: 'Lesson Rescheduled',
        message: `Your lesson with ${booking.student.name} has been rescheduled to ${booking.scheduledStart.toLocaleString()}.`,
        metadata: { bookingId, eventType, studentName: booking.student.name },
      });
      break;
  }

  // Create all notifications
  if (notifications.length > 0) {
    await createNotifications(notifications);
  }

  return notifications;
}

/**
 * Get notifications for a user
 */
export async function getUserNotifications(
  userId: string,
  options: {
    limit?: number;
    offset?: number;
    unreadOnly?: boolean;
    type?: NotificationType;
  } = {}
) {
  const { limit = 50, offset = 0, unreadOnly = false, type } = options;

  const where: Prisma.NotificationWhereInput = {
    userId,
    ...(unreadOnly && { isRead: false }),
    ...(type && { type }),
  };

  const [notifications, total] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.notification.count({ where }),
  ]);

  return {
    notifications,
    total,
    hasMore: offset + notifications.length < total,
  };
}

/**
 * Mark notification as read
 */
export async function markNotificationAsRead(notificationId: string, userId: string) {
  const notification = await prisma.notification.updateMany({
    where: {
      id: notificationId,
      userId, // Ensure user owns this notification
    },
    data: {
      isRead: true,
    },
  });

  return notification.count > 0;
}

/**
 * Mark multiple notifications as read
 */
export async function markNotificationsAsRead(notificationIds: string[], userId: string) {
  const result = await prisma.notification.updateMany({
    where: {
      id: { in: notificationIds },
      userId, // Ensure user owns these notifications
    },
    data: {
      isRead: true,
    },
  });

  return result.count;
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllNotificationsAsRead(userId: string) {
  const result = await prisma.notification.updateMany({
    where: {
      userId,
      isRead: false,
    },
    data: {
      isRead: true,
    },
  });

  return result.count;
}

/**
 * Get unread notification count for a user
 */
export async function getUnreadCount(userId: string) {
  const count = await prisma.notification.count({
    where: {
      userId,
      isRead: false,
    },
  });

  return count;
}

/**
 * Delete old read notifications (cleanup)
 */
export async function deleteOldNotifications(daysOld: number = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);

  const result = await prisma.notification.deleteMany({
    where: {
      isRead: true,
      createdAt: {
        lt: cutoffDate,
      },
    },
  });

  return result.count;
}
