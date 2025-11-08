/**
 * Prisma Seed Script
 * Populates the database with representative sample data for development and testing
 */

import { PrismaClient } from '@prisma/client';
import { addDays, addHours, subDays } from 'date-fns';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed...');

  // ============================================================================
  // WEATHER MINIMUMS
  // ============================================================================
  console.log('📊 Seeding weather minimums...');

  const weatherMinimums = await Promise.all([
    prisma.weatherMinimum.upsert({
      where: { trainingLevel: 'STUDENT_PILOT' },
      update: {},
      create: {
        trainingLevel: 'STUDENT_PILOT',
        visibilityMiles: 5.0,
        ceilingFeet: 3000,
        windSpeedKnots: 10,
        windGustKnots: 15,
        prohibitedConditions: ['THUNDERSTORM', 'FREEZING', 'ICE', 'SNOW', 'FOG'],
        description: 'Weather minimums for student pilot training flights',
      },
    }),
    prisma.weatherMinimum.upsert({
      where: { trainingLevel: 'PRIVATE_PILOT' },
      update: {},
      create: {
        trainingLevel: 'PRIVATE_PILOT',
        visibilityMiles: 3.0,
        ceilingFeet: 1000,
        windSpeedKnots: 15,
        windGustKnots: 20,
        prohibitedConditions: ['THUNDERSTORM', 'FREEZING', 'ICE'],
        description: 'Weather minimums for private pilot flights',
      },
    }),
    prisma.weatherMinimum.upsert({
      where: { trainingLevel: 'INSTRUMENT_RATED' },
      update: {},
      create: {
        trainingLevel: 'INSTRUMENT_RATED',
        visibilityMiles: 0.5,
        ceilingFeet: 200,
        windSpeedKnots: 20,
        windGustKnots: 30,
        prohibitedConditions: ['THUNDERSTORM', 'SEVERE_ICING', 'TORNADO'],
        description: 'Weather minimums for instrument-rated pilot flights',
      },
    }),
  ]);

  console.log(`✅ Created ${weatherMinimums.length} weather minimum records`);

  // ============================================================================
  // USERS
  // ============================================================================
  console.log('👥 Seeding users...');

  // Admin (UUID: 00000000-0000-0000-0000-000000000003)
  const admin = await prisma.user.upsert({
    where: { email: 'admin@flightschool.com' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000003',
      email: 'admin@flightschool.com',
      name: 'Admin User',
      role: 'ADMIN',
      trainingLevel: null,
    },
  });

  // Instructors
  const instructor1 = await prisma.user.upsert({
    where: { email: 'john.instructor@flightschool.com' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      email: 'john.instructor@flightschool.com',
      name: 'John Smith',
      role: 'INSTRUCTOR',
      trainingLevel: 'INSTRUMENT_RATED',
      availability: {
        weeklySchedule: {
          MON: [{ start: '09:00', end: '17:00' }],
          TUE: [{ start: '09:00', end: '17:00' }],
          WED: [{ start: '09:00', end: '17:00' }],
          THU: [{ start: '09:00', end: '17:00' }],
          FRI: [{ start: '09:00', end: '15:00' }],
        },
        exceptions: [],
      },
    },
  });

  const instructor2 = await prisma.user.upsert({
    where: { email: 'sarah.instructor@flightschool.com' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000004',
      email: 'sarah.instructor@flightschool.com',
      name: 'Sarah Johnson',
      role: 'INSTRUCTOR',
      trainingLevel: 'INSTRUMENT_RATED',
      availability: {
        weeklySchedule: {
          MON: [{ start: '13:00', end: '20:00' }],
          TUE: [{ start: '13:00', end: '20:00' }],
          WED: [{ start: '13:00', end: '20:00' }],
          THU: [{ start: '13:00', end: '20:00' }],
          SAT: [{ start: '08:00', end: '16:00' }],
        },
        exceptions: [],
      },
    },
  });

  // Students
  const studentPilot = await prisma.user.upsert({
    where: { email: 'alice.student@example.com' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000002',
      email: 'alice.student@example.com',
      name: 'Alice Brown',
      role: 'STUDENT',
      trainingLevel: 'STUDENT_PILOT',
    },
  });

  const privatePilot = await prisma.user.upsert({
    where: { email: 'bob.student@example.com' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000005',
      email: 'bob.student@example.com',
      name: 'Bob Wilson',
      role: 'STUDENT',
      trainingLevel: 'PRIVATE_PILOT',
    },
  });

  const instrumentStudent = await prisma.user.upsert({
    where: { email: 'carol.student@example.com' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000006',
      email: 'carol.student@example.com',
      name: 'Carol Davis',
      role: 'STUDENT',
      trainingLevel: 'INSTRUMENT_RATED',
    },
  });

  console.log('✅ Created 6 users (1 admin, 2 instructors, 3 students)');

  // ============================================================================
  // BOOKINGS
  // ============================================================================
  console.log('✈️  Seeding bookings...');

  // Upcoming scheduled booking (tomorrow)
  const scheduledBooking = await prisma.booking.create({
    data: {
      studentId: studentPilot.id,
      instructorId: instructor1.id,
      departureLocation: 'KPAO', // Palo Alto Airport
      arrivalLocation: 'KSQL', // San Carlos Airport
      scheduledStart: addDays(new Date(), 1),
      scheduledEnd: addDays(addHours(new Date(), 2), 1),
      duration: 120,
      flightType: 'CROSS_COUNTRY',
      status: 'SCHEDULED',
      notes: 'First cross-country flight',
    },
  });

  // Booking with weather hold (day after tomorrow)
  const weatherHoldBooking = await prisma.booking.create({
    data: {
      studentId: privatePilot.id,
      instructorId: instructor2.id,
      departureLocation: 'KPAO',
      arrivalLocation: 'KPAO', // Local flight
      scheduledStart: addDays(new Date(), 2),
      scheduledEnd: addDays(addHours(new Date(), 1.5), 2),
      duration: 90,
      flightType: 'LOCAL',
      status: 'WEATHER_HOLD',
      notes: 'Pattern work and touch-and-goes',
    },
  });

  // Booking awaiting response (3 days out)
  const awaitingResponseBooking = await prisma.booking.create({
    data: {
      studentId: instrumentStudent.id,
      instructorId: instructor1.id,
      departureLocation: 'KPAO',
      arrivalLocation: 'KSJC', // San Jose
      scheduledStart: addDays(new Date(), 3),
      scheduledEnd: addDays(addHours(new Date(), 2.5), 3),
      duration: 150,
      flightType: 'CROSS_COUNTRY',
      status: 'AWAITING_RESPONSE',
      notes: 'IFR training flight',
    },
  });

  // Completed booking (yesterday)
  const completedBooking = await prisma.booking.create({
    data: {
      studentId: studentPilot.id,
      instructorId: instructor1.id,
      departureLocation: 'KPAO',
      arrivalLocation: 'KPAO',
      scheduledStart: subDays(addHours(new Date(), -2), 1),
      scheduledEnd: subDays(new Date(), 1),
      duration: 120,
      flightType: 'LOCAL',
      status: 'COMPLETED',
      notes: 'Solo practice - landings',
    },
  });

  console.log('✅ Created 4 bookings with various statuses');

  // ============================================================================
  // WEATHER CHECKS
  // ============================================================================
  console.log('🌦️  Seeding weather checks...');

  // Weather check for completed booking (safe)
  await prisma.weatherCheck.create({
    data: {
      bookingId: completedBooking.id,
      timestamp: subDays(addHours(new Date(), -3), 1),
      waypointData: {
        waypoints: [
          {
            lat: 37.4613,
            lon: -122.1149,
            time: subDays(addHours(new Date(), -2), 1).toISOString(),
            visibility: 10.0,
            ceiling: 5000,
            windSpeed: 8,
            windGust: 12,
            conditions: ['CLEAR'],
            safe: true,
            violations: [],
          },
        ],
      },
      overallStatus: 'SAFE',
      violationReasons: [],
    },
  });

  // Weather check for weather hold booking (unsafe)
  await prisma.weatherCheck.create({
    data: {
      bookingId: weatherHoldBooking.id,
      timestamp: new Date(),
      waypointData: {
        waypoints: [
          {
            lat: 37.4613,
            lon: -122.1149,
            time: addDays(new Date(), 2).toISOString(),
            visibility: 2.0,
            ceiling: 800,
            windSpeed: 18,
            windGust: 25,
            conditions: ['FOG', 'MIST'],
            safe: false,
            violations: ['VISIBILITY_BELOW_MINIMUM', 'CEILING_TOO_LOW', 'WIND_GUST_EXCEEDS_LIMIT'],
          },
        ],
      },
      overallStatus: 'UNSAFE',
      violationReasons: ['VISIBILITY_BELOW_MINIMUM', 'CEILING_TOO_LOW', 'WIND_GUST_EXCEEDS_LIMIT', 'FOG_PRESENT'],
    },
  });

  console.log('✅ Created 2 weather checks');

  // ============================================================================
  // RESCHEDULE LOGS
  // ============================================================================
  console.log('🔄 Seeding reschedule logs...');

  // Three AI suggestions for the weather hold booking
  await prisma.rescheduleLog.createMany({
    data: [
      {
        bookingId: weatherHoldBooking.id,
        proposedDateTime: addDays(addHours(new Date(), 10), 3),
        reasoning: 'Weather forecast shows clear conditions with 10+ mile visibility, light winds at 6-8 knots, and VFR conditions throughout the day. Instructor availability confirmed.',
        confidence: 0.95,
        isSelected: false,
        metadata: {
          model: 'gpt-4',
          processingTimeMs: 1234,
          weatherSnapshot: { visibility: 10, ceiling: 'unlimited', windSpeed: 7 },
        },
      },
      {
        bookingId: weatherHoldBooking.id,
        proposedDateTime: addDays(addHours(new Date(), 14), 3),
        reasoning: 'Afternoon slot with excellent weather conditions. Winds calm at 5 knots, clear skies. Slightly later time allows morning fog to fully dissipate.',
        confidence: 0.88,
        isSelected: false,
        metadata: {
          model: 'gpt-4',
          processingTimeMs: 1156,
          weatherSnapshot: { visibility: 10, ceiling: 'unlimited', windSpeed: 5 },
        },
      },
      {
        bookingId: weatherHoldBooking.id,
        proposedDateTime: addDays(addHours(new Date(), 9), 4),
        reasoning: 'Next day option with stable high pressure system. Forecast shows CAVU (ceiling and visibility unlimited) conditions. Backup option if earlier slots unavailable.',
        confidence: 0.82,
        isSelected: false,
        metadata: {
          model: 'gpt-4',
          processingTimeMs: 1089,
          weatherSnapshot: { visibility: 10, ceiling: 'unlimited', windSpeed: 8 },
        },
      },
    ],
  });

  // One suggestion for the awaiting response booking
  await prisma.rescheduleLog.create({
    data: {
      bookingId: awaitingResponseBooking.id,
      proposedDateTime: addDays(addHours(new Date(), 15), 4),
      reasoning: 'Rescheduled to accommodate instructor availability conflict. Weather conditions remain favorable with IFR training-appropriate cloud layers at 2500 feet.',
      confidence: 0.91,
      isSelected: true,
      selectedAt: new Date(),
      metadata: {
        model: 'gpt-4',
        processingTimeMs: 987,
        weatherSnapshot: { visibility: 5, ceiling: 2500, windSpeed: 12 },
      },
    },
  });

  console.log('✅ Created 4 reschedule logs');

  // ============================================================================
  // NOTIFICATIONS
  // ============================================================================
  console.log('🔔 Seeding notifications...');

  await prisma.notification.createMany({
    data: [
      // Weather alert for student pilot
      {
        userId: privatePilot.id,
        type: 'WEATHER_ALERT',
        channel: 'IN_APP',
        title: 'Weather Hold - Booking Delayed',
        message: `Your flight scheduled for ${weatherHoldBooking.scheduledStart.toLocaleString()} has been placed on weather hold due to unsafe conditions. We'll send you rescheduling options shortly.`,
        isRead: false,
        deliveredAt: new Date(),
        metadata: { bookingId: weatherHoldBooking.id },
      },
      {
        userId: privatePilot.id,
        type: 'WEATHER_ALERT',
        channel: 'EMAIL',
        title: 'Weather Hold - Booking Delayed',
        message: `Your flight scheduled for ${weatherHoldBooking.scheduledStart.toLocaleString()} has been placed on weather hold due to unsafe conditions.`,
        isRead: false,
        deliveredAt: new Date(),
        metadata: { bookingId: weatherHoldBooking.id },
      },
      // Reschedule suggestion for student pilot
      {
        userId: privatePilot.id,
        type: 'RESCHEDULE_SUGGESTION',
        channel: 'IN_APP',
        title: 'New Rescheduling Options Available',
        message: 'We have 3 alternative time slots available for your flight. Please review and select your preferred option.',
        isRead: false,
        deliveredAt: new Date(),
        metadata: { bookingId: weatherHoldBooking.id, suggestionCount: 3 },
      },
      // Confirmation for instrument student
      {
        userId: instrumentStudent.id,
        type: 'CONFIRMATION',
        channel: 'IN_APP',
        title: 'Flight Rescheduled Successfully',
        message: `Your flight has been rescheduled to ${addDays(addHours(new Date(), 15), 4).toLocaleString()}. Your instructor John Smith has confirmed availability.`,
        isRead: true,
        deliveredAt: subDays(new Date(), 1),
        metadata: { bookingId: awaitingResponseBooking.id },
      },
      // Reminder for upcoming flight
      {
        userId: studentPilot.id,
        type: 'REMINDER',
        channel: 'IN_APP',
        title: 'Flight Reminder - Tomorrow',
        message: `Reminder: Your flight is scheduled for tomorrow at ${scheduledBooking.scheduledStart.toLocaleString()}. Weather conditions look favorable.`,
        isRead: false,
        deliveredAt: new Date(),
        metadata: { bookingId: scheduledBooking.id },
      },
    ],
  });

  console.log('✅ Created 5 notifications');

  // ============================================================================
  // SUMMARY
  // ============================================================================
  console.log('\n✨ Seed completed successfully!\n');

  console.log('📊 Summary:');
  console.log(`  - ${weatherMinimums.length} weather minimum records`);
  console.log('  - 6 users (1 admin, 2 instructors, 3 students)');
  console.log('  - 4 bookings (various statuses)');
  console.log('  - 2 weather checks');
  console.log('  - 4 reschedule logs');
  console.log('  - 5 notifications');
  console.log('\n🎯 Test Accounts:');
  console.log('  Admin: admin@flightschool.com');
  console.log('  Instructor: john.instructor@flightschool.com');
  console.log('  Instructor: sarah.instructor@flightschool.com');
  console.log('  Student (Student Pilot): alice.student@example.com');
  console.log('  Student (Private Pilot): bob.student@example.com');
  console.log('  Student (Instrument Rated): carol.student@example.com');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('❌ Seed failed:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
