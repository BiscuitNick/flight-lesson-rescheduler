/**
 * Notification Center Component
 * Displays notifications with read/unread management and filtering
 */

'use client';

import { useState } from 'react';
import { useNotifications } from '@/lib/hooks/useNotifications';
import type { NotificationType } from '@prisma/client';
import { Bell, Check, CheckCheck, Filter, X } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface NotificationCenterProps {
  userId: string;
  onClose?: () => void;
}

export function NotificationCenter({ userId, onClose }: NotificationCenterProps) {
  const [filterType, setFilterType] = useState<NotificationType | 'ALL'>('ALL');
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);

  const { notifications, unreadCount, isConnected, isPolling, markAsRead, markAllAsRead } =
    useNotifications({
      enabled: true,
      userId,
    });

  // Filter notifications
  const filteredNotifications = notifications.filter((n) => {
    if (showUnreadOnly && n.isRead) return false;
    if (filterType !== 'ALL' && n.type !== filterType) return false;
    return true;
  });

  const getNotificationIcon = (type: NotificationType) => {
    switch (type) {
      case 'WEATHER_ALERT':
        return '⚠️';
      case 'RESCHEDULE_SUGGESTION':
        return '📅';
      case 'CONFIRMATION':
        return '✅';
      case 'REMINDER':
        return '🔔';
      case 'SYSTEM_MESSAGE':
        return 'ℹ️';
      default:
        return '📬';
    }
  };

  const getNotificationColor = (type: NotificationType) => {
    switch (type) {
      case 'WEATHER_ALERT':
        return 'bg-amber-50 border-amber-200';
      case 'RESCHEDULE_SUGGESTION':
        return 'bg-blue-50 border-blue-200';
      case 'CONFIRMATION':
        return 'bg-green-50 border-green-200';
      case 'REMINDER':
        return 'bg-purple-50 border-purple-200';
      case 'SYSTEM_MESSAGE':
        return 'bg-gray-50 border-gray-200';
      default:
        return 'bg-white border-gray-200';
    }
  };

  return (
    <div className="flex flex-col h-full bg-white shadow-lg rounded-lg overflow-hidden max-w-md w-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-gray-700" />
            <h2 className="text-lg font-semibold text-gray-900">Notifications</h2>
            {unreadCount > 0 && (
              <span className="px-2 py-0.5 text-xs font-medium bg-blue-600 text-white rounded-full">
                {unreadCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Connection status */}
            <div className="flex items-center gap-1 text-xs">
              <div
                className={`w-2 h-2 rounded-full ${
                  isConnected ? 'bg-green-500' : isPolling ? 'bg-yellow-500' : 'bg-gray-400'
                }`}
              />
              <span className="text-gray-600">
                {isConnected ? 'Live' : isPolling ? 'Polling' : 'Offline'}
              </span>
            </div>
            {onClose && (
              <button
                onClick={onClose}
                className="p-1 hover:bg-gray-200 rounded transition-colors"
                aria-label="Close notifications"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 mt-3">
          <button
            onClick={() => setShowUnreadOnly(!showUnreadOnly)}
            className={`px-3 py-1 text-xs rounded-full transition-colors ${
              showUnreadOnly
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {showUnreadOnly ? 'Unread Only' : 'All'}
          </button>

          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as NotificationType | 'ALL')}
            className="px-3 py-1 text-xs rounded-full bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors border-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="ALL">All Types</option>
            <option value="WEATHER_ALERT">Weather Alerts</option>
            <option value="RESCHEDULE_SUGGESTION">Reschedule</option>
            <option value="CONFIRMATION">Confirmations</option>
            <option value="REMINDER">Reminders</option>
            <option value="SYSTEM_MESSAGE">System</option>
          </select>

          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="ml-auto px-3 py-1 text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
            >
              <CheckCheck className="w-3 h-3" />
              Mark all read
            </button>
          )}
        </div>
      </div>

      {/* Notification List */}
      <div className="flex-1 overflow-y-auto">
        {filteredNotifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full p-8 text-center">
            <Bell className="w-12 h-12 text-gray-300 mb-3" />
            <p className="text-gray-500 font-medium">No notifications</p>
            <p className="text-gray-400 text-sm mt-1">
              {showUnreadOnly ? "You're all caught up!" : 'No notifications to display'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredNotifications.map((notification) => (
              <div
                key={notification.id}
                className={`p-4 transition-colors hover:bg-gray-50 ${
                  !notification.isRead ? 'bg-blue-50/30' : ''
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Icon */}
                  <div className="flex-shrink-0 text-2xl">
                    {getNotificationIcon(notification.type)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-semibold text-gray-900 leading-tight">
                        {notification.title}
                      </h3>
                      {!notification.isRead && (
                        <button
                          onClick={() => markAsRead(notification.id)}
                          className="flex-shrink-0 p-1 hover:bg-gray-200 rounded transition-colors"
                          aria-label="Mark as read"
                          title="Mark as read"
                        >
                          <Check className="w-4 h-4 text-blue-600" />
                        </button>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mt-1 leading-relaxed">
                      {notification.message}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs text-gray-500">
                        {formatDistanceToNow(new Date(notification.createdAt), {
                          addSuffix: true,
                        })}
                      </span>
                      <span
                        className={`px-2 py-0.5 text-xs rounded-full ${
                          notification.isRead
                            ? 'bg-gray-100 text-gray-600'
                            : 'bg-blue-100 text-blue-700 font-medium'
                        }`}
                      >
                        {notification.isRead ? 'Read' : 'New'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
