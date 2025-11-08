/**
 * tRPC initialization
 * Defines base procedures and middleware
 */

import { initTRPC } from '@trpc/server';
import { type Context, assertAuthenticated } from './context';
import superjson from 'superjson';

/**
 * Initialize tRPC with context type
 */
const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape }) {
    return shape;
  },
});

/**
 * Export reusable router and procedure helpers
 */
export const createTRPCRouter = t.router;
export const createCallerFactory = t.createCallerFactory;

/**
 * Public (unprotected) procedure
 * Can be called by anyone without authentication
 */
export const publicProcedure = t.procedure;

/**
 * Protected procedure
 * Requires authentication - will throw UNAUTHORIZED if user is not logged in
 */
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  assertAuthenticated(ctx.user);

  return next({
    ctx: {
      ...ctx,
      user: ctx.user, // user is now guaranteed to be non-null
    },
  });
});

/**
 * Middleware type export for custom middleware
 */
export const middleware = t.middleware;
