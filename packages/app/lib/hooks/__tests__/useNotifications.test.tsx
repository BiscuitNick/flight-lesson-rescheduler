/**
 * useNotifications Hook Tests
 */

import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useNotifications } from '../useNotifications';

// Mock tRPC
vi.mock('../../trpc/client', () => ({
  trpc: {
    notifications: {
      list: {
        useQuery: vi.fn(() => ({
          data: { notifications: [], total: 0, hasMore: false },
        })),
      },
      unreadCount: {
        useQuery: vi.fn(() => ({
          data: { count: 0 },
        })),
      },
      markAsRead: {
        useMutation: vi.fn(() => ({
          mutateAsync: vi.fn(),
        })),
      },
      markAllAsRead: {
        useMutation: vi.fn(() => ({
          mutateAsync: vi.fn(),
        })),
      },
    },
  },
}));

describe('useNotifications Hook', () => {
  it('should initialize with default state', () => {
    const { result } = renderHook(() => useNotifications({ enabled: false }));

    expect(result.current.notifications).toEqual([]);
    expect(result.current.unreadCount).toBe(0);
    expect(result.current.isConnected).toBe(false);
    expect(result.current.isPolling).toBe(false);
  });

  it('should provide markAsRead function', () => {
    const { result } = renderHook(() => useNotifications({ enabled: false }));

    expect(result.current.markAsRead).toBeDefined();
    expect(typeof result.current.markAsRead).toBe('function');
  });

  it('should provide markAllAsRead function', () => {
    const { result } = renderHook(() => useNotifications({ enabled: false }));

    expect(result.current.markAllAsRead).toBeDefined();
    expect(typeof result.current.markAllAsRead).toBe('function');
  });
});
