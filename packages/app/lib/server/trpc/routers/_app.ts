/**
 * Main tRPC router
 * Combines all sub-routers
 */

import { createTRPCRouter } from '../init';
import { userRouter } from './user';
import { bookingsRouter } from './bookings';
import { instructorsRouter } from './instructors';
import { weatherRouter } from './weather';

/**
 * App router - combines all feature routers
 */
export const appRouter = createTRPCRouter({
  user: userRouter,
  bookings: bookingsRouter,
  instructors: instructorsRouter,
  weather: weatherRouter,
  // Additional routers will be added here:
  // reschedule: rescheduleRouter,
  // notifications: notificationsRouter,
});

/**
 * Export type definition of API
 */
export type AppRouter = typeof appRouter;
