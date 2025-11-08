/**
 * Notification Badge Component
 * Displays unread notification count with real-time updates
 */

'use client';

import { useState } from 'react';
import { useNotifications } from '@/lib/hooks/useNotifications';
import { Bell } from 'lucide-react';
import { NotificationCenter } from './NotificationCenter';

interface NotificationBadgeProps {
  userId: string;
  className?: string;
}

export function NotificationBadge({ userId, className = '' }: NotificationBadgeProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { unreadCount } = useNotifications({ enabled: true, userId });

  return (
    <>
      {/* Badge Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`relative p-2 hover:bg-gray-100 rounded-full transition-colors ${className}`}
        aria-label="Notifications"
      >
        <Bell className="w-6 h-6 text-gray-700" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 px-1.5 py-0.5 text-xs font-bold bg-red-600 text-white rounded-full min-w-[18px] text-center">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Panel */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/20 z-40"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />

          {/* Panel */}
          <div className="fixed top-16 right-4 z-50 w-full max-w-md h-[calc(100vh-5rem)] sm:h-auto sm:max-h-[80vh]">
            <NotificationCenter userId={userId} onClose={() => setIsOpen(false)} />
          </div>
        </>
      )}
    </>
  );
}
