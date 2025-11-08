-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "citext";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('STUDENT', 'INSTRUCTOR', 'ADMIN');
CREATE TYPE "TrainingLevel" AS ENUM ('STUDENT_PILOT', 'PRIVATE_PILOT', 'INSTRUMENT_RATED');
CREATE TYPE "BookingStatus" AS ENUM ('SCHEDULED', 'WEATHER_HOLD', 'AWAITING_RESPONSE', 'CONFIRMED', 'CANCELLED', 'COMPLETED');
CREATE TYPE "WeatherStatus" AS ENUM ('SAFE', 'MARGINAL', 'UNSAFE');
CREATE TYPE "NotificationType" AS ENUM ('WEATHER_ALERT', 'RESCHEDULE_SUGGESTION', 'CONFIRMATION', 'REMINDER', 'SYSTEM_MESSAGE');
CREATE TYPE "NotificationChannel" AS ENUM ('EMAIL', 'SMS', 'IN_APP');

-- CreateTable: users
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "email" CITEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "trainingLevel" "TrainingLevel",
    "availability" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable: bookings
CREATE TABLE "bookings" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "studentId" UUID NOT NULL,
    "instructorId" UUID NOT NULL,
    "departureLocation" TEXT NOT NULL,
    "arrivalLocation" TEXT NOT NULL,
    "scheduledStart" TIMESTAMP(3) NOT NULL,
    "scheduledEnd" TIMESTAMP(3) NOT NULL,
    "duration" INTEGER NOT NULL,
    "flightType" TEXT NOT NULL,
    "status" "BookingStatus" NOT NULL DEFAULT 'SCHEDULED',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable: weather_checks
CREATE TABLE "weather_checks" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "bookingId" UUID NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "waypointData" JSONB NOT NULL,
    "overallStatus" "WeatherStatus" NOT NULL,
    "violationReasons" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "weather_checks_pkey" PRIMARY KEY ("id")
);

-- CreateTable: reschedule_logs
CREATE TABLE "reschedule_logs" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "bookingId" UUID NOT NULL,
    "proposedDateTime" TIMESTAMP(3) NOT NULL,
    "reasoning" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "isSelected" BOOLEAN NOT NULL DEFAULT false,
    "selectedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reschedule_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable: notifications
CREATE TABLE "notifications" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "userId" UUID NOT NULL,
    "type" "NotificationType" NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "deliveredAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable: weather_minimums
CREATE TABLE "weather_minimums" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "trainingLevel" "TrainingLevel" NOT NULL,
    "visibilityMiles" DOUBLE PRECISION NOT NULL,
    "ceilingFeet" INTEGER NOT NULL,
    "windSpeedKnots" INTEGER NOT NULL,
    "windGustKnots" INTEGER NOT NULL,
    "prohibitedConditions" TEXT[],
    "description" TEXT,
    "effectiveDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "weather_minimums_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE INDEX "users_email_idx" ON "users"("email");
CREATE INDEX "users_role_idx" ON "users"("role");

CREATE INDEX "bookings_studentId_idx" ON "bookings"("studentId");
CREATE INDEX "bookings_instructorId_idx" ON "bookings"("instructorId");
CREATE INDEX "bookings_status_idx" ON "bookings"("status");
CREATE INDEX "bookings_scheduledStart_idx" ON "bookings"("scheduledStart");

CREATE INDEX "weather_checks_bookingId_idx" ON "weather_checks"("bookingId");
CREATE INDEX "weather_checks_timestamp_idx" ON "weather_checks"("timestamp");
CREATE INDEX "weather_checks_overallStatus_idx" ON "weather_checks"("overallStatus");

CREATE INDEX "reschedule_logs_bookingId_idx" ON "reschedule_logs"("bookingId");
CREATE INDEX "reschedule_logs_isSelected_idx" ON "reschedule_logs"("isSelected");
CREATE INDEX "reschedule_logs_proposedDateTime_idx" ON "reschedule_logs"("proposedDateTime");

CREATE INDEX "notifications_userId_idx" ON "notifications"("userId");
CREATE INDEX "notifications_type_idx" ON "notifications"("type");
CREATE INDEX "notifications_isRead_idx" ON "notifications"("isRead");
CREATE INDEX "notifications_createdAt_idx" ON "notifications"("createdAt");

CREATE UNIQUE INDEX "weather_minimums_trainingLevel_key" ON "weather_minimums"("trainingLevel");
CREATE INDEX "weather_minimums_trainingLevel_idx" ON "weather_minimums"("trainingLevel");

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "weather_checks" ADD CONSTRAINT "weather_checks_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "reschedule_logs" ADD CONSTRAINT "reschedule_logs_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
