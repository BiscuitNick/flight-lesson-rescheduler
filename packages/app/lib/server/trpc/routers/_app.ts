/**
 * Main tRPC router
 * Combines all sub-routers
 */

import { createTRPCRouter } from '../init';
import { userRouter } from './user';
import { bookingsRouter } from './bookings';
import { instructorsRouter } from './instructors';

/**
 * App router - combines all feature routers
 */
export const appRouter = createTRPCRouter({
  user: userRouter,
  bookings: bookingsRouter,
  instructors: instructorsRouter,
  // Additional routers will be added here:
  // weather: weatherRouter,
  // reschedule: rescheduleRouter,
  // notifications: notificationsRouter,
});

/**
 * Export type definition of API
 */
export type AppRouter = typeof appRouter;
