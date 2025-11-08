/**
 * Main tRPC router
 * Combines all sub-routers
 */

import { createTRPCRouter } from '../init';
import { userRouter } from './user';

/**
 * App router - combines all feature routers
 */
export const appRouter = createTRPCRouter({
  user: userRouter,
  // Additional routers will be added here:
  // bookings: bookingsRouter,
  // weather: weatherRouter,
  // reschedule: rescheduleRouter,
  // notifications: notificationsRouter,
});

/**
 * Export type definition of API
 */
export type AppRouter = typeof appRouter;
