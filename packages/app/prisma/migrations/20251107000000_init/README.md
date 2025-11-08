# Initial Migration - Flight Lesson Rescheduler

## Overview
This migration sets up the complete database schema for the Flight Lesson Rescheduler system.

## Prisma Version
- **Prisma**: 5.22.0
- **@prisma/client**: 5.22.0

This migration is explicitly designed for Prisma 5.x and avoids any Prisma 6.x-only features.

## PostgreSQL Extensions
This migration enables two required PostgreSQL extensions:
1. **uuid-ossp**: For UUID generation via `uuid_generate_v4()`
2. **citext**: For case-insensitive email storage

## Schema Components

### Enums
- `UserRole`: STUDENT, INSTRUCTOR, ADMIN
- `TrainingLevel`: STUDENT_PILOT, PRIVATE_PILOT, INSTRUMENT_RATED
- `BookingStatus`: SCHEDULED, WEATHER_HOLD, AWAITING_RESPONSE, CONFIRMED, CANCELLED, COMPLETED
- `WeatherStatus`: SAFE, MARGINAL, UNSAFE
- `NotificationType`: WEATHER_ALERT, RESCHEDULE_SUGGESTION, CONFIRMATION, REMINDER, SYSTEM_MESSAGE
- `NotificationChannel`: EMAIL, SMS, IN_APP

### Tables
1. **users**: User accounts with roles, training levels, and instructor availability
2. **bookings**: Flight lesson schedules with locations, times, and status tracking
3. **weather_checks**: Historical weather evaluations for bookings
4. **reschedule_logs**: AI-generated rescheduling suggestions
5. **notifications**: Multi-channel notification delivery tracking
6. **weather_minimums**: Training level-specific weather minimum requirements

### Key Features
- UUID primary keys for all tables
- CITEXT for case-insensitive email lookup
- JSONB for flexible data structures (availability, waypoint data, metadata)
- Comprehensive indexing for query performance
- Foreign key constraints with CASCADE deletes
- Created/updated timestamps on all tables

## Running This Migration

When database is available:
```bash
npx prisma migrate deploy
```

Or for development:
```bash
npx prisma migrate dev
```

## Verification

After running the migration:
```bash
# Check migration status
npx prisma migrate status

# Open Prisma Studio to inspect schema
npx prisma studio
```
