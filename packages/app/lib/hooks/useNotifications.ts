/**
 * useNotifications Hook
 * Real-time notification listener with SSE and fallback polling
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { trpc } from '../trpc/client';
import type { Notification } from '@prisma/client';

interface NotificationEvent {
  type: 'connected' | 'backfill' | 'notification' | 'error';
  data?: {
    message?: string;
    notifications?: Notification[];
  } | Notification;
}

interface UseNotificationsOptions {
  enabled?: boolean;
  userId?: string;
  onNotification?: (notification: Notification) => void;
}

const SSE_RETRY_DELAYS = [1000, 2000, 5000, 10000, 30000]; // Exponential backoff
const SSE_MAX_RETRIES = 5;
const POLLING_FALLBACK_INTERVAL = 30000; // 30 seconds

export function useNotifications(options: UseNotificationsOptions = {}) {
  const { enabled = true, userId, onNotification } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const eventSourceRef = useRef<EventSource | null>(null);
  const retryCountRef = useRef(0);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // tRPC hooks for fallback and operations
  const { data: notificationData } = trpc.notifications.list.useQuery(
    { limit: 50, unreadOnly: false },
    { enabled: !isConnected && isPolling }
  );

  const { data: unreadData } = trpc.notifications.unreadCount.useQuery(undefined, {
    refetchInterval: isPolling ? POLLING_FALLBACK_INTERVAL : false,
  });

  const markAsReadMutation = trpc.notifications.markAsRead.useMutation();
  const markAllAsReadMutation = trpc.notifications.markAllAsRead.useMutation();

  // Update unread count
  useEffect(() => {
    if (unreadData) {
      setUnreadCount(unreadData.count);
    }
  }, [unreadData]);

  // Update notifications from polling
  useEffect(() => {
    if (notificationData?.notifications) {
      setNotifications(notificationData.notifications);
    }
  }, [notificationData]);

  /**
   * Handle incoming notification
   */
  const handleNotification = useCallback(
    (notification: Notification) => {
      setNotifications((prev) => [notification, ...prev]);
      setUnreadCount((prev) => prev + 1);

      if (onNotification) {
        onNotification(notification);
      }
    },
    [onNotification]
  );

  /**
   * Connect to SSE stream
   */
  const connectSSE = useCallback(() => {
    if (!userId || !enabled) return;

    try {
      const url = `/api/notifications/stream?userId=${encodeURIComponent(userId)}`;
      const eventSource = new EventSource(url);

      eventSource.onopen = () => {
        console.log('SSE connection opened');
        setIsConnected(true);
        setIsPolling(false);
        retryCountRef.current = 0;
      };

      eventSource.onmessage = (event) => {
        try {
          const data: NotificationEvent = JSON.parse(event.data);

          switch (data.type) {
            case 'connected':
              console.log('SSE connected:', data.data);
              break;

            case 'backfill':
              if (data.data && 'notifications' in data.data && data.data.notifications) {
                setNotifications(data.data.notifications);
              }
              break;

            case 'notification':
              if (data.data && 'id' in data.data) {
                handleNotification(data.data as Notification);
              }
              break;

            case 'error':
              console.error('SSE error event:', data.data);
              break;
          }
        } catch (error) {
          console.error('Failed to parse SSE message:', error);
        }
      };

      eventSource.onerror = (error) => {
        console.error('SSE connection error:', error);
        eventSource.close();
        setIsConnected(false);

        // Retry with exponential backoff
        if (retryCountRef.current < SSE_MAX_RETRIES) {
          const delay = SSE_RETRY_DELAYS[retryCountRef.current] || SSE_RETRY_DELAYS[SSE_RETRY_DELAYS.length - 1];
          retryCountRef.current++;

          console.log(`Retrying SSE connection in ${delay}ms (attempt ${retryCountRef.current}/${SSE_MAX_RETRIES})`);

          retryTimeoutRef.current = setTimeout(() => {
            connectSSE();
          }, delay);
        } else {
          console.warn('SSE max retries reached, falling back to polling');
          setIsPolling(true);
        }
      };

      eventSourceRef.current = eventSource;
    } catch (error) {
      console.error('Failed to create SSE connection:', error);
      setIsPolling(true);
    }
  }, [userId, enabled, handleNotification]);

  /**
   * Disconnect from SSE stream
   */
  const disconnectSSE = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }

    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }

    setIsConnected(false);
  }, []);

  /**
   * Mark notification as read
   */
  const markAsRead = useCallback(
    async (notificationId: string) => {
      try {
        await markAsReadMutation.mutateAsync({ notificationId });

        // Update local state
        setNotifications((prev) =>
          prev.map((n) => (n.id === notificationId ? { ...n, isRead: true } : n))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      } catch (error) {
        console.error('Failed to mark notification as read:', error);
      }
    },
    [markAsReadMutation]
  );

  /**
   * Mark all notifications as read
   */
  const markAllAsRead = useCallback(async () => {
    try {
      await markAllAsReadMutation.mutateAsync();

      // Update local state
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
    }
  }, [markAllAsReadMutation]);

  // Connect/disconnect based on enabled state
  useEffect(() => {
    if (enabled && userId) {
      connectSSE();
    } else {
      disconnectSSE();
    }

    return () => {
      disconnectSSE();
    };
  }, [enabled, userId, connectSSE, disconnectSSE]);

  return {
    notifications,
    unreadCount,
    isConnected,
    isPolling,
    markAsRead,
    markAllAsRead,
    reconnect: connectSSE,
  };
}
