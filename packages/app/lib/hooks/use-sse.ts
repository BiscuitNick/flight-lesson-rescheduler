'use client';

import { useEffect, useState } from 'react';

interface SSEMessage {
  type: string;
  message: string;
  [key: string]: unknown;
}

/**
 * Custom hook for Server-Sent Events (SSE) notifications
 * Connects to /api/notifications/stream endpoint
 *
 * @param enabled - Whether to establish the SSE connection
 * @returns Object containing connection status and latest message
 *
 * @example
 * ```tsx
 * const { isConnected, lastMessage } = useSSE(true);
 * ```
 */
export function useSSE(enabled: boolean = false) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<SSEMessage | null>(null);

  useEffect(() => {
    if (!enabled) return;

    // Create EventSource connection
    const eventSource = new EventSource('/api/notifications/stream');

    eventSource.onopen = () => {
      console.log('SSE connection established');
      setIsConnected(true);
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setLastMessage(data);
      } catch (error) {
        console.error('Failed to parse SSE message:', error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('SSE connection error:', error);
      setIsConnected(false);
    };

    // Cleanup on unmount
    return () => {
      eventSource.close();
      setIsConnected(false);
    };
  }, [enabled]);

  return { isConnected, lastMessage };
}
