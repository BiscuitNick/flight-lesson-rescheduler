/**
 * Server-Sent Events (SSE) endpoint for real-time notifications
 * Streams notifications to authenticated users via Redis pub/sub
 */

import { NextRequest } from 'next/server';
import { subscribeToUserNotifications } from '@/lib/server/redis/notifications-pubsub';
import { getUserNotifications } from '@/lib/server/services/notifications.service';
import type { Notification } from '@prisma/client';

// Keep-alive interval in milliseconds
const KEEPALIVE_INTERVAL = 30000; // 30 seconds

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/notifications/stream
 * Establishes SSE connection for real-time notifications
 */
export async function GET(request: NextRequest) {
  // TODO: Add authentication check here
  // For now, we'll extract userId from query params (this should be from session/JWT)
  const searchParams = request.nextUrl.searchParams;
  const userId = searchParams.get('userId');

  if (!userId) {
    return new Response('Unauthorized: userId required', { status: 401 });
  }

  // Set up SSE headers
  const headers = new Headers({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no', // Disable nginx buffering
  });

  // Create a readable stream
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      // Helper to send SSE message
      const sendEvent = (event: { type: string; data?: unknown }) => {
        const message = `data: ${JSON.stringify(event)}\n\n`;
        try {
          controller.enqueue(encoder.encode(message));
        } catch (error) {
          console.error('Error sending SSE event:', error);
        }
      };

      // Send initial connection message
      sendEvent({ type: 'connected', data: { message: 'SSE stream connected' } });

      // Backfill recent unread notifications
      try {
        const { notifications } = await getUserNotifications(userId, {
          limit: 10,
          unreadOnly: true,
        });

        if (notifications.length > 0) {
          sendEvent({
            type: 'backfill',
            data: { notifications },
          });
        }
      } catch (error) {
        console.error('Error fetching backfill notifications:', error);
      }

      // Set up keep-alive ping
      const keepAliveTimer = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(':ping\n\n'));
        } catch (error) {
          console.error('Error sending keep-alive:', error);
          clearInterval(keepAliveTimer);
        }
      }, KEEPALIVE_INTERVAL);

      // Subscribe to Redis pub/sub for new notifications
      let unsubscribe: (() => Promise<void>) | null = null;

      try {
        unsubscribe = await subscribeToUserNotifications(userId, (notification: Notification) => {
          sendEvent({
            type: 'notification',
            data: notification,
          });
        });
      } catch (error) {
        console.error('Error subscribing to notifications:', error);
        sendEvent({
          type: 'error',
          data: { message: 'Failed to subscribe to notifications' },
        });
      }

      // Handle cleanup on connection close
      const cleanup = async () => {
        clearInterval(keepAliveTimer);

        if (unsubscribe) {
          try {
            await unsubscribe();
          } catch (error) {
            console.error('Error unsubscribing from notifications:', error);
          }
        }

        try {
          controller.close();
        } catch (error) {
          // Controller might already be closed
        }
      };

      // Listen for client disconnect
      request.signal.addEventListener('abort', cleanup);

      // Store cleanup function for later use
      (controller as any).cleanup = cleanup;
    },

    cancel() {
      // Called when the stream is cancelled
      console.log('SSE stream cancelled');
    },
  });

  return new Response(stream, { headers });
}
