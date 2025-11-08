# Prisma Database Client

This module provides a production-ready Prisma client with additional utilities for the Flight Lesson Rescheduler application.

## Features

- **Singleton Pattern**: Prevents multiple Prisma client instances in development
- **Connection Pooling**: Optimized for both Next.js and AWS Lambda
- **Health Checks**: Utility to verify database connectivity
- **Transaction Wrapper**: Automatic retry logic for transient errors
- **Batch Operations**: Process large datasets efficiently with progress tracking
- **Type Safety**: Full TypeScript support with exported Prisma types

## Usage

### Basic Usage

```typescript
import { prisma } from '@/lib/server/db';

// Query users
const users = await prisma.user.findMany({
  where: { role: 'STUDENT' },
});

// Create a booking
const booking = await prisma.booking.create({
  data: {
    studentId: '...',
    instructorId: '...',
    departureLocation: 'KPAO',
    arrivalLocation: 'KSQL',
    scheduledStart: new Date(),
    scheduledEnd: new Date(),
    duration: 120,
    flightType: 'CROSS_COUNTRY',
  },
});
```

### Health Checks

Useful for API health endpoints and Lambda warmup:

```typescript
import { checkDatabaseConnection } from '@/lib/server/db';

export async function GET() {
  const isHealthy = await checkDatabaseConnection();

  return Response.json({
    database: isHealthy ? 'connected' : 'disconnected',
  });
}
```

### Transactions with Retry Logic

Automatically retries on transient errors (deadlocks, timeouts):

```typescript
import { withTransaction } from '@/lib/server/db';

const result = await withTransaction(async (tx) => {
  // Create booking
  const booking = await tx.booking.create({
    data: { ... },
  });

  // Create notification
  const notification = await tx.notification.create({
    data: {
      userId: booking.studentId,
      type: 'CONFIRMATION',
      ...
    },
  });

  return { booking, notification };
}, 3); // max 3 retries
```

### Batch Operations

Process large datasets efficiently:

```typescript
import { batchOperation } from '@/lib/server/db';

const userIds = [...]; // Array of 1000 user IDs

const notifications = await batchOperation(
  userIds,
  async (userId) => {
    return prisma.notification.create({
      data: {
        userId,
        type: 'SYSTEM_MESSAGE',
        title: 'System Update',
        message: 'New features available!',
      },
    });
  },
  100, // batch size
  (completed, total) => {
    console.log(`Progress: ${completed}/${total}`);
  }
);
```

### Type Exports

All Prisma types are exported for convenience:

```typescript
import type {
  User,
  Booking,
  UserRole,
  BookingStatus,
  TrainingLevel,
} from '@/lib/server/db';

function processBooking(booking: Booking, student: User) {
  if (student.role !== 'STUDENT') {
    throw new Error('User must be a student');
  }

  if (booking.status === 'WEATHER_HOLD') {
    // Handle weather hold
  }
}
```

## Next.js API Routes

### App Router (Route Handlers)

```typescript
// app/api/bookings/route.ts
import { prisma } from '@/lib/server/db';
import { NextResponse } from 'next/server';

export async function GET() {
  const bookings = await prisma.booking.findMany({
    include: {
      student: true,
      instructor: true,
    },
  });

  return NextResponse.json(bookings);
}
```

### Server Components

```typescript
// app/dashboard/page.tsx
import { prisma } from '@/lib/server/db';

export default async function DashboardPage() {
  const bookings = await prisma.booking.findMany({
    where: {
      status: 'SCHEDULED',
    },
  });

  return (
    <div>
      <h1>Upcoming Bookings</h1>
      {bookings.map((booking) => (
        <BookingCard key={booking.id} booking={booking} />
      ))}
    </div>
  );
}
```

## AWS Lambda Usage

The Prisma client works seamlessly in Lambda functions:

```typescript
// packages/functions/weather-monitor/src/index.ts
import { prisma, checkDatabaseConnection } from '@/lib/server/db';

export async function handler(event: any) {
  // Check connection on cold start
  const isConnected = await checkDatabaseConnection();
  if (!isConnected) {
    throw new Error('Database connection failed');
  }

  // Fetch bookings
  const bookings = await prisma.booking.findMany({
    where: {
      scheduledStart: {
        gte: new Date(),
        lte: addHours(new Date(), 48),
      },
      status: 'SCHEDULED',
    },
  });

  // Process bookings...

  return {
    statusCode: 200,
    body: JSON.stringify({ processed: bookings.length }),
  };
}
```

## Connection Management

### Development

In development, the singleton pattern prevents connection exhaustion during hot reloading:

- First import creates the Prisma client
- Subsequent imports reuse the same instance
- Connections are managed automatically

### Production

In production, each deployment gets a fresh Prisma client instance:

- Optimized connection pooling
- Automatic reconnection on transient failures
- Compatible with serverless environments

### Cleanup

For testing or graceful shutdowns:

```typescript
import { disconnectPrisma } from '@/lib/server/db';

// In test teardown
afterAll(async () => {
  await disconnectPrisma();
});

// In graceful shutdown
process.on('SIGTERM', async () => {
  await disconnectPrisma();
  process.exit(0);
});
```

## Testing

The module includes comprehensive unit tests:

```bash
npm run test lib/server/db/prisma.test.ts
```

Tests cover:
- Singleton pattern behavior
- Health check functionality
- Transaction retry logic
- Batch operation processing
- Error handling

## Environment Variables

Required environment variable:

```env
DATABASE_URL="postgresql://user:password@host:5432/database?schema=public"
```

For AWS Lambda with RDS Proxy:

```env
DATABASE_URL="postgresql://user:password@rds-proxy-endpoint:5432/database"
```

## Best Practices

1. **Always use the exported `prisma` instance** - Never create new `PrismaClient()` instances
2. **Use transactions for related operations** - Ensures data consistency
3. **Leverage batch operations for bulk updates** - Better performance than sequential operations
4. **Add indexes for frequently queried fields** - Already configured in schema
5. **Monitor connection pool usage** - Use CloudWatch or similar in production

## Performance Tips

- Use `select` to fetch only needed fields
- Use `include` judiciously to avoid N+1 queries
- Leverage Prisma's query batching for multiple parallel queries
- Consider read replicas for heavy read workloads
- Use connection pooling (PgBouncer) for high-traffic applications

## Troubleshooting

### Connection Pool Exhausted

If you see "Too many connections" errors:

1. Check that you're using the singleton instance
2. Verify no lingering connections in dev mode
3. Consider using PgBouncer for connection pooling

### Slow Queries

1. Check query explain plans
2. Ensure proper indexes exist
3. Use Prisma Studio to inspect query performance
4. Monitor with CloudWatch Insights in production

### Type Errors

If TypeScript can't find types after schema changes:

```bash
npx prisma generate
```

This regenerates the Prisma Client with updated types.

## Related Documentation

- [Prisma Client API](https://www.prisma.io/docs/reference/api-reference/prisma-client-reference)
- [Prisma Best Practices](https://www.prisma.io/docs/guides/performance-and-optimization/connection-management)
- [Next.js with Prisma](https://www.prisma.io/docs/guides/other/troubleshooting-orm/help-articles/nextjs-prisma-client-dev-practices)
