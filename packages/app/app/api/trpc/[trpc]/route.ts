import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { type NextRequest } from 'next/server';

// Handler will be implemented with full tRPC router setup
// This is a placeholder for the tRPC API route handler

const handler = (req: NextRequest) => {
  return fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    router: {} as any, // Router to be implemented in Task 3
    createContext: () => ({}), // Context to be implemented in Task 3
  });
};

export { handler as GET, handler as POST };
