/**
 * tRPC client setup
 * Configures React Query and tRPC for client-side use
 */

import { httpBatchLink } from '@trpc/client';
import { createTRPCReact } from '@trpc/react-query';
import type { AppRouter } from '@/lib/server/trpc/routers/_app';
import superjson from 'superjson';

/**
 * tRPC React hooks
 */
export const trpc = createTRPCReact<AppRouter>();

/**
 * Get base URL for tRPC requests
 */
function getBaseUrl() {
  if (typeof window !== 'undefined') {
    // Browser should use relative path
    return '';
  }

  // SSR should use absolute URL
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  // Dev server
  return `http://localhost:${process.env.PORT ?? 3000}`;
}

/**
 * Create tRPC client
 */
export function createTRPCClient() {
  return trpc.createClient({
    links: [
      httpBatchLink({
        url: `${getBaseUrl()}/api/trpc`,
        transformer: superjson,
        headers() {
          return {
            // Include any additional headers here
          };
        },
      }),
    ],
  });
}
