/**
 * Notifications Pub/Sub Manager
 * Handles Redis pub/sub for real-time notification delivery via SSE
 */

import { getRedisPubClient, getRedisSubClient } from './client';
import type { Notification } from '@prisma/client';

const NOTIFICATION_CHANNEL_PREFIX = 'notifications:user:';

export interface NotificationEvent {
  type: 'notification';
  data: Notification;
}

/**
 * Publish a notification event to a user's channel
 */
export async function publishNotification(userId: string, notification: Notification): Promise<void> {
  try {
    const pubClient = await getRedisPubClient();
    const channel = `${NOTIFICATION_CHANNEL_PREFIX}${userId}`;

    const event: NotificationEvent = {
      type: 'notification',
      data: notification,
    };

    await pubClient.publish(channel, JSON.stringify(event));

    console.log('Published notification to Redis', {
      userId,
      notificationId: notification.id,
      channel,
    });
  } catch (error) {
    console.error('Failed to publish notification to Redis:', error);
    // Don't throw - notification is already in DB, SSE is best-effort
  }
}

/**
 * Publish multiple notifications to user channels
 */
export async function publishNotifications(
  notifications: Array<{ userId: string; notification: Notification }>
): Promise<void> {
  try {
    const pubClient = await getRedisPubClient();

    // Group notifications by user for efficient publishing
    const grouped = new Map<string, Notification[]>();
    for (const { userId, notification } of notifications) {
      if (!grouped.has(userId)) {
        grouped.set(userId, []);
      }
      grouped.get(userId)!.push(notification);
    }

    // Publish to each user's channel
    const publishPromises: Promise<number>[] = [];

    for (const [userId, userNotifications] of grouped) {
      const channel = `${NOTIFICATION_CHANNEL_PREFIX}${userId}`;

      for (const notification of userNotifications) {
        const event: NotificationEvent = {
          type: 'notification',
          data: notification,
        };

        publishPromises.push(pubClient.publish(channel, JSON.stringify(event)));
      }
    }

    await Promise.all(publishPromises);

    console.log('Published batch notifications to Redis', {
      userCount: grouped.size,
      totalNotifications: notifications.length,
    });
  } catch (error) {
    console.error('Failed to publish batch notifications to Redis:', error);
    // Don't throw - notifications are already in DB, SSE is best-effort
  }
}

/**
 * Subscribe to a user's notification channel
 */
export async function subscribeToUserNotifications(
  userId: string,
  callback: (notification: Notification) => void
): Promise<() => Promise<void>> {
  const subClient = await getRedisSubClient();
  const channel = `${NOTIFICATION_CHANNEL_PREFIX}${userId}`;

  const messageHandler = (message: string) => {
    try {
      const event: NotificationEvent = JSON.parse(message);
      if (event.type === 'notification') {
        callback(event.data);
      }
    } catch (error) {
      console.error('Failed to parse notification event:', error);
    }
  };

  await subClient.subscribe(channel, messageHandler);

  console.log('Subscribed to user notifications', { userId, channel });

  // Return unsubscribe function
  return async () => {
    await subClient.unsubscribe(channel);
    console.log('Unsubscribed from user notifications', { userId, channel });
  };
}

/**
 * Get channel name for a user
 */
export function getUserNotificationChannel(userId: string): string {
  return `${NOTIFICATION_CHANNEL_PREFIX}${userId}`;
}
