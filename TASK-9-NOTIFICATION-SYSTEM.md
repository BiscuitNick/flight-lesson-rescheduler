# Task 9: Notification Pipeline & SSE Real-time Delivery

## Overview

This document describes the implementation of the multi-channel notification system with Server-Sent Events (SSE) for real-time delivery, completed as part of Task 9.

## Features Implemented

### 1. Backend Notification Service
- **Location**: `packages/app/lib/server/services/notifications.service.ts`
- **Features**:
  - Create and manage notification records
  - Handle SNS notification payloads
  - Query notifications with filtering (type, read/unread)
  - Mark notifications as read (single or batch)
  - Get unread notification counts

### 2. Redis Pub/Sub Infrastructure
- **Location**: `packages/app/lib/server/redis/`
- **Components**:
  - **client.ts**: Singleton Redis clients for pub/sub operations
  - **notifications-pubsub.ts**: Notification-specific pub/sub manager
- **Features**:
  - Publish notifications to user-specific channels
  - Subscribe to real-time notification events
  - Support for batch notification publishing

### 3. SSE Endpoint
- **Location**: `packages/app/app/api/notifications/stream/route.ts`
- **Features**:
  - Server-Sent Events streaming for real-time updates
  - Automatic backfill of recent unread notifications on connect
  - Keep-alive ping to maintain connection
  - Automatic cleanup on disconnect
  - Per-user notification channels

### 4. tRPC Router
- **Location**: `packages/app/lib/server/trpc/routers/notifications.ts`
- **Endpoints**:
  - `list`: Get paginated notifications with filtering
  - `unreadCount`: Get count of unread notifications
  - `markAsRead`: Mark single notification as read
  - `markMultipleAsRead`: Mark multiple notifications as read
  - `markAllAsRead`: Mark all user notifications as read

### 5. Frontend Hook
- **Location**: `packages/app/lib/hooks/useNotifications.ts`
- **Features**:
  - Real-time SSE connection with auto-reconnect
  - Exponential backoff retry strategy
  - Automatic fallback to REST polling on SSE failure
  - Mark as read functionality
  - Connection status tracking

### 6. UI Components
- **NotificationCenter** (`components/notifications/NotificationCenter.tsx`):
  - Full notification list with filtering
  - Read/unread status toggle
  - Type-based filtering
  - Mark as read actions
  - Connection status indicator
  - Time-based sorting

- **NotificationBadge** (`components/notifications/NotificationBadge.tsx`):
  - Real-time unread count badge
  - Dropdown notification panel
  - One-click access to notification center

### 7. Lambda Integration
Updated both Lambda functions to create notification records:

- **Weather Monitor Lambda** (`packages/functions/weather-monitor/src/index.ts`):
  - Creates WEATHER_ALERT notifications when bookings are placed on weather hold
  - Notifies both student and instructor

- **AI Rescheduler Lambda** (`packages/functions/ai-rescheduler/src/index.ts`):
  - Creates RESCHEDULE_SUGGESTION notifications when AI generates suggestions
  - Notifies both student and instructor

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Client Browser                            │
│  ┌─────────────────┐                  ┌────────────────────┐   │
│  │ NotificationBadge│─────────────────│ NotificationCenter │   │
│  └─────────────────┘                  └────────────────────┘   │
│           │                                      │               │
│           └──────────────────┬───────────────────┘               │
│                              │                                   │
│                    ┌─────────▼────────────┐                     │
│                    │ useNotifications Hook │                     │
│                    └─────────┬────────────┘                     │
│                              │                                   │
└──────────────────────────────┼───────────────────────────────────┘
                               │
                    ┌──────────┴──────────┐
                    │                     │
            ┌───────▼───────┐    ┌───────▼────────┐
            │  SSE Stream   │    │  tRPC Router   │
            │ /api/notifications│ │ notifications  │
            │    /stream    │    │                │
            └───────┬───────┘    └───────┬────────┘
                    │                     │
            ┌───────▼───────────────────┬─▼────────┐
            │      Redis Pub/Sub        │  Prisma   │
            │  (Real-time events)       │   (DB)    │
            └───────▲───────────────────┴──────────┘
                    │
        ┌───────────┴────────────┐
        │                        │
  ┌─────▼─────────┐     ┌───────▼──────────┐
  │ Weather       │     │ AI Rescheduler   │
  │ Monitor       │     │ Lambda           │
  │ Lambda        │     │                  │
  └───────────────┘     └──────────────────┘
```

## Database Schema

The Notification model (already defined in Prisma schema):

```prisma
model Notification {
  id          String              @id @default(uuid()) @db.Uuid
  userId      String              @db.Uuid
  type        NotificationType    // WEATHER_ALERT, RESCHEDULE_SUGGESTION, etc.
  channel     NotificationChannel // EMAIL, SMS, IN_APP
  title       String
  message     String              @db.Text
  isRead      Boolean             @default(false)
  deliveredAt DateTime?
  metadata    Json?
  createdAt   DateTime            @default(now())
  user        User                @relation(...)
}
```

## Environment Variables

Add to `.env`:

```bash
# Redis URL for SSE pub/sub and caching
REDIS_URL="redis://localhost:6379"
```

## Usage

### Backend - Creating Notifications

```typescript
import { createNotification } from '@/lib/server/services/notifications.service';

await createNotification({
  userId: 'user-id',
  type: 'WEATHER_ALERT',
  channel: 'IN_APP',
  title: 'Weather Hold',
  message: 'Your lesson has been placed on weather hold',
  metadata: { bookingId: 'booking-id' },
});
```

### Frontend - Using the Hook

```typescript
import { useNotifications } from '@/lib/hooks/useNotifications';

function MyComponent() {
  const {
    notifications,
    unreadCount,
    isConnected,
    markAsRead,
    markAllAsRead,
  } = useNotifications({
    enabled: true,
    userId: currentUser.id,
    onNotification: (notification) => {
      // Handle new notification (e.g., show toast)
      toast.info(notification.title);
    },
  });

  return (
    <div>
      <p>Unread: {unreadCount}</p>
      {notifications.map((n) => (
        <div key={n.id}>
          {n.title}
          {!n.isRead && (
            <button onClick={() => markAsRead(n.id)}>Mark Read</button>
          )}
        </div>
      ))}
    </div>
  );
}
```

### Frontend - Using the Badge Component

```typescript
import { NotificationBadge } from '@/components/notifications/NotificationBadge';

function Header() {
  return (
    <nav>
      <NotificationBadge userId={currentUser.id} />
    </nav>
  );
}
```

## Testing

### Unit Tests

```bash
# Run notification service tests
npm run test:unit -- notifications.service.test.ts

# Run hook tests
npm run test:unit -- useNotifications.test.tsx
```

### Integration Testing

1. Start Redis: `docker-compose up redis`
2. Start the dev server: `npm run dev`
3. Open browser console and monitor SSE connection
4. Trigger a weather hold (via Lambda or manual DB update)
5. Verify notification appears in real-time

### Testing SSE Connection

```bash
# Test SSE endpoint manually
curl -N "http://localhost:3000/api/notifications/stream?userId=<user-id>"
```

## Connection Resilience

The notification system implements several resilience strategies:

1. **Exponential Backoff**: SSE reconnects with delays: 1s, 2s, 5s, 10s, 30s
2. **Max Retries**: After 5 failed SSE attempts, falls back to polling
3. **Polling Fallback**: Polls every 30 seconds when SSE unavailable
4. **Keep-Alive**: 30-second ping to prevent connection timeout
5. **Automatic Cleanup**: Proper cleanup on disconnect

## Performance Considerations

- **Redis Pub/Sub**: O(1) publishing, scales to millions of channels
- **SSE Backfill**: Limited to 10 most recent unread notifications
- **Pagination**: List endpoint supports limit/offset for large datasets
- **Indexes**: Database indexes on `userId`, `isRead`, `type`, `createdAt`

## Future Enhancements

1. **Email Notifications**: Integrate SES for email delivery
2. **Push Notifications**: Add web push for background notifications
3. **Notification Preferences**: Allow users to configure notification types
4. **Read Receipts**: Track when notifications were actually viewed
5. **Notification Grouping**: Group similar notifications (e.g., multiple weather holds)
6. **Sound/Visual Alerts**: Browser notifications and sounds for important alerts

## Deployment Checklist

- [ ] Redis instance provisioned and accessible
- [ ] `REDIS_URL` environment variable set
- [ ] Lambda functions updated with notification creation logic
- [ ] Database migration run (if schema changes)
- [ ] Test SSE endpoint connectivity
- [ ] Verify Redis pub/sub working
- [ ] Monitor CloudWatch logs for errors
- [ ] Test with multiple concurrent users

## Troubleshooting

### SSE Not Connecting

1. Check Redis is running: `redis-cli ping`
2. Verify `REDIS_URL` environment variable
3. Check browser console for connection errors
4. Verify userId is being passed to SSE endpoint

### Notifications Not Appearing

1. Check notification records in database
2. Verify Lambda functions creating notifications
3. Check Redis pub/sub: `redis-cli PSUBSCRIBE 'notifications:user:*'`
4. Verify user is subscribed to correct channel

### High Memory Usage

1. Implement notification cleanup job (deleteOldNotifications)
2. Set up cron to run cleanup weekly
3. Monitor Redis memory usage
4. Consider Redis eviction policies

## Related Files

- Notification Service: `packages/app/lib/server/services/notifications.service.ts`
- tRPC Router: `packages/app/lib/server/trpc/routers/notifications.ts`
- Redis Client: `packages/app/lib/server/redis/client.ts`
- Redis Pub/Sub: `packages/app/lib/server/redis/notifications-pubsub.ts`
- SSE Endpoint: `packages/app/app/api/notifications/stream/route.ts`
- Hook: `packages/app/lib/hooks/useNotifications.ts`
- UI Components: `packages/app/components/notifications/`
- Weather Lambda: `packages/functions/weather-monitor/src/index.ts`
- AI Lambda: `packages/functions/ai-rescheduler/src/index.ts`
