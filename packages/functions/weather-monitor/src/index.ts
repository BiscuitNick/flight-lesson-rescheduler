import type { EventBridgeEvent } from 'aws-lambda';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { addHours } from 'date-fns';
import { getPrismaClient } from './prisma';
import {
  createWeatherClient,
  calculateWaypoints,
  evaluateRoute,
  getViolationReasons,
  type TrainingLevel,
  type Waypoint,
  type WeatherCondition,
} from '@flight-rescheduler/weather-lib';
import type { WeatherConflictPayload, WeatherCheckResult } from './types';

// AWS Configuration
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';
const AWS_ENDPOINT_URL = process.env.AWS_ENDPOINT_URL; // For LocalStack
const SQS_QUEUE_URL = process.env.SQS_QUEUE_URL;

// Weather API Configuration
const OPENWEATHERMAP_API_KEY = process.env.OPENWEATHERMAP_API_KEY;

/**
 * Lambda 1: Weather Monitor
 * Triggered hourly by EventBridge to check weather for upcoming bookings
 *
 * Flow:
 * 1. Fetch bookings within next 48h with status SCHEDULED
 * 2. For each booking:
 *    a. Calculate flight waypoints
 *    b. Fetch weather for each waypoint
 *    c. Evaluate against training level minimums
 *    d. If unsafe: update booking status, create weather check record, publish to SQS
 */
export async function handler(event: EventBridgeEvent<string, unknown>) {
  console.log('Weather Monitor Lambda triggered', {
    time: event.time,
    source: event.source,
  });

  const prisma = getPrismaClient();

  // Initialize weather client
  if (!OPENWEATHERMAP_API_KEY) {
    console.error('OPENWEATHERMAP_API_KEY is not set');
    throw new Error('Weather API key is required');
  }

  const weatherClient = createWeatherClient(OPENWEATHERMAP_API_KEY);

  // Initialize SQS client
  const sqsClient = new SQSClient({
    region: AWS_REGION,
    endpoint: AWS_ENDPOINT_URL,
  });

  try {
    // 1. Fetch bookings within next 48 hours that are SCHEDULED
    const now = new Date();
    const futureWindow = addHours(now, 48);

    console.log('Fetching bookings', {
      from: now.toISOString(),
      to: futureWindow.toISOString(),
    });

    const bookings = await prisma.booking.findMany({
      where: {
        status: 'SCHEDULED',
        scheduledStart: {
          gte: now,
          lte: futureWindow,
        },
      },
      include: {
        student: true,
        instructor: true,
      },
      orderBy: {
        scheduledStart: 'asc',
      },
    });

    console.log(`Found ${bookings.length} bookings to check`);

    const results: WeatherCheckResult[] = [];
    const conflicts: WeatherConflictPayload[] = [];

    // 2. Process each booking
    for (const booking of bookings) {
      try {
        console.log(`Checking booking ${booking.id}`, {
          student: booking.student.email,
          scheduledStart: booking.scheduledStart.toISOString(),
        });

        // Get student's training level
        const trainingLevel = booking.student.trainingLevel as TrainingLevel | null;
        if (!trainingLevel) {
          console.warn(`Booking ${booking.id} - student has no training level, skipping`);
          continue;
        }

        // 2a. Calculate waypoints
        const waypoints = calculateWaypoints(
          booking.departureLocation,
          booking.arrivalLocation,
          booking.scheduledStart,
          booking.duration
        );

        console.log(`Generated ${waypoints.length} waypoints for booking ${booking.id}`);

        // 2b. Fetch weather for each waypoint
        const weatherData = await weatherClient.getWeatherForWaypoints(waypoints);

        // 2c. Evaluate route against minimums
        const waypointsWithWeather = waypoints.map((waypoint, index) => ({
          waypoint,
          weather: weatherData[index],
        }));

        const routeEvaluation = evaluateRoute(waypointsWithWeather, trainingLevel);

        console.log(`Booking ${booking.id} evaluation`, {
          safe: routeEvaluation.safe,
          overallStatus: routeEvaluation.overallStatus,
          violations: routeEvaluation.violationSummary,
        });

        // Prepare weather check data
        const waypointData = routeEvaluation.waypoints.map((wp) => ({
          lat: wp.waypoint.lat,
          lon: wp.waypoint.lon,
          timestamp: wp.waypoint.timestamp.toISOString(),
          visibility: wp.weather.visibility,
          ceiling: wp.weather.ceiling,
          windSpeed: wp.weather.windSpeed,
          windGust: wp.weather.windGust,
          conditions: wp.weather.conditions,
          safe: wp.safe,
          violations: wp.violations,
        }));

        const violationReasons = getViolationReasons(routeEvaluation);

        // Create weather check record
        await prisma.weatherCheck.create({
          data: {
            bookingId: booking.id,
            waypointData: waypointData,
            overallStatus: routeEvaluation.overallStatus,
            violationReasons,
          },
        });

        // 2d. If unsafe, update booking and publish to SQS
        if (!routeEvaluation.safe) {
          console.log(`Booking ${booking.id} has weather conflicts, updating status`);

          // Update booking status to WEATHER_HOLD
          await prisma.booking.update({
            where: { id: booking.id },
            data: { status: 'WEATHER_HOLD' },
          });

          // Prepare conflict payload for SQS
          const conflictPayload: WeatherConflictPayload = {
            bookingId: booking.id,
            studentId: booking.studentId,
            instructorId: booking.instructorId,
            scheduledStart: booking.scheduledStart.toISOString(),
            scheduledEnd: booking.scheduledEnd.toISOString(),
            departureLocation: booking.departureLocation,
            arrivalLocation: booking.arrivalLocation,
            trainingLevel,
            violationSummary: routeEvaluation.violationSummary,
            overallStatus: routeEvaluation.overallStatus,
            checkedAt: new Date().toISOString(),
          };

          conflicts.push(conflictPayload);

          // Publish to SQS
          if (SQS_QUEUE_URL) {
            await publishToSQS(sqsClient, conflictPayload);
          } else {
            console.warn('SQS_QUEUE_URL not set, skipping SQS publish');
          }
        }

        results.push({
          bookingId: booking.id,
          hasConflict: !routeEvaluation.safe,
          overallStatus: routeEvaluation.overallStatus,
          violationReasons,
          waypointData,
        });
      } catch (error) {
        console.error(`Error processing booking ${booking.id}:`, error);
        // Continue processing other bookings
        continue;
      }
    }

    console.log('Weather check complete', {
      totalBookings: bookings.length,
      conflicts: conflicts.length,
      safe: results.filter((r) => !r.hasConflict).length,
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Weather check complete',
        stats: {
          totalBookings: bookings.length,
          conflicts: conflicts.length,
          safe: results.filter((r) => !r.hasConflict).length,
        },
        results,
      }),
    };
  } catch (error) {
    console.error('Weather monitor error:', error);
    throw error;
  }
}

/**
 * Publish weather conflict to SQS queue
 */
async function publishToSQS(
  sqsClient: SQSClient,
  payload: WeatherConflictPayload
): Promise<void> {
  if (!SQS_QUEUE_URL) {
    throw new Error('SQS_QUEUE_URL is not configured');
  }

  const command = new SendMessageCommand({
    QueueUrl: SQS_QUEUE_URL,
    MessageBody: JSON.stringify(payload),
    MessageAttributes: {
      bookingId: {
        DataType: 'String',
        StringValue: payload.bookingId,
      },
      overallStatus: {
        DataType: 'String',
        StringValue: payload.overallStatus,
      },
      checkedAt: {
        DataType: 'String',
        StringValue: payload.checkedAt,
      },
    },
    // Deduplication ID for exactly-once processing (if using FIFO queue)
    // MessageDeduplicationId: payload.bookingId,
  });

  try {
    const response = await sqsClient.send(command);
    console.log('Published to SQS', {
      messageId: response.MessageId,
      bookingId: payload.bookingId,
    });
  } catch (error) {
    console.error('Failed to publish to SQS:', error);
    throw error;
  }
}
