import type { SQSEvent, SQSRecord } from 'aws-lambda';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import { addDays, addHours, isWithinInterval, parseISO, startOfDay } from 'date-fns';
import { getPrismaClient } from './prisma';
import { createWeatherClient, calculateWaypoints, evaluateRoute, type TrainingLevel } from '@flight-rescheduler/weather-lib';
import type {
  WeatherConflictPayload,
  RescheduleOption,
  AIRescheduleResponse,
  RescheduleContext,
  RescheduleNotificationPayload,
} from './types';

// AWS Configuration
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';
const AWS_ENDPOINT_URL = process.env.AWS_ENDPOINT_URL; // For LocalStack
const SNS_TOPIC_ARN = process.env.SNS_TOPIC_ARN;

// AI Configuration
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const AI_MODEL = process.env.AI_MODEL || 'gpt-4o';

// Weather API Configuration
const OPENWEATHERMAP_API_KEY = process.env.OPENWEATHERMAP_API_KEY;

// Business Configuration
const MAX_SUGGESTIONS = 3;
const SEARCH_WINDOW_DAYS = 14; // Look ahead 2 weeks for alternative slots
const MIN_CONFIDENCE_THRESHOLD = 0.6;

/**
 * Zod schema for AI response validation
 */
const aiResponseSchema = z.object({
  suggestions: z.array(
    z.object({
      dateTime: z.string().refine((val) => !isNaN(Date.parse(val)), {
        message: 'Invalid ISO date string',
      }),
      reasoning: z.string().min(10).max(500),
      confidence: z.number().min(0).max(1),
    })
  ).min(1).max(MAX_SUGGESTIONS),
});

/**
 * Lambda 2: AI Rescheduler
 * Triggered by SQS messages from Weather Monitor Lambda
 *
 * Flow:
 * 1. Parse SQS batch messages
 * 2. For each booking:
 *    a. Fetch booking details, instructor availability, weather forecast
 *    b. Generate GPT-4 reschedule suggestions with reasoning
 *    c. Validate suggestions against availability and weather
 *    d. Persist reschedule logs with metadata
 *    e. Update booking status to AWAITING_RESPONSE
 *    f. Publish notification to SNS
 */
export async function handler(event: SQSEvent) {
  console.log('AI Rescheduler Lambda triggered', {
    recordCount: event.Records.length,
  });

  const prisma = getPrismaClient();

  // Initialize SNS client
  const snsClient = new SNSClient({
    region: AWS_REGION,
    endpoint: AWS_ENDPOINT_URL,
  });

  const results = {
    successful: 0,
    failed: 0,
    errors: [] as Array<{ bookingId: string; error: string }>,
  };

  // Process each SQS record
  for (const record of event.Records) {
    try {
      await processRecord(record, prisma, snsClient);
      results.successful++;
    } catch (error) {
      console.error('Failed to process record:', error);
      const payload = tryParsePayload(record);
      results.failed++;
      results.errors.push({
        bookingId: payload?.bookingId || 'unknown',
        error: error instanceof Error ? error.message : String(error),
      });
      // Continue processing other records instead of failing entire batch
    }
  }

  console.log('AI Rescheduler processing complete', results);

  return {
    statusCode: 200,
    body: JSON.stringify({
      message: 'Reschedule suggestions generated',
      stats: results,
    }),
  };
}

/**
 * Process a single SQS record
 */
async function processRecord(
  record: SQSRecord,
  prisma: ReturnType<typeof getPrismaClient>,
  snsClient: SNSClient
): Promise<void> {
  // 1. Parse SQS message payload
  const payload = parsePayload(record);

  console.log('Processing booking', {
    bookingId: payload.bookingId,
    violations: payload.violationSummary,
  });

  // 2. Fetch booking details with relations
  const booking = await prisma.booking.findUnique({
    where: { id: payload.bookingId },
    include: {
      student: true,
      instructor: true,
    },
  });

  if (!booking) {
    throw new Error(`Booking ${payload.bookingId} not found`);
  }

  // Skip if booking is no longer in WEATHER_HOLD status (may have been manually handled)
  if (booking.status !== 'WEATHER_HOLD') {
    console.log(`Booking ${payload.bookingId} is no longer in WEATHER_HOLD status, skipping`);
    return;
  }

  // 3. Build context for AI prompt
  const context: RescheduleContext = {
    booking: {
      id: booking.id,
      studentId: booking.studentId,
      instructorId: booking.instructorId,
      departureLocation: booking.departureLocation,
      arrivalLocation: booking.arrivalLocation,
      scheduledStart: booking.scheduledStart,
      scheduledEnd: booking.scheduledEnd,
      duration: booking.duration,
      trainingLevel: payload.trainingLevel,
    },
    violations: payload.violationSummary,
    instructorAvailability: booking.instructor.availability,
  };

  // 4. Generate AI reschedule suggestions
  const aiSuggestions = await generateRescheduleSuggestions(context);

  console.log(`Generated ${aiSuggestions.length} AI suggestions for booking ${booking.id}`);

  // 5. Validate suggestions against instructor availability and weather
  const validatedOptions = await validateSuggestions(
    aiSuggestions,
    context,
    prisma
  );

  console.log(`${validatedOptions.length} validated suggestions for booking ${booking.id}`);

  if (validatedOptions.length === 0) {
    console.warn(`No valid suggestions found for booking ${booking.id}`);
    // Consider fallback: generate more suggestions or use heuristic approach
    // For now, we'll still update status but with no suggestions
  }

  // 6. Persist reschedule logs and create notifications in a transaction
  await prisma.$transaction(async (tx: typeof prisma) => {
    // Create reschedule log entries
    await tx.rescheduleLog.createMany({
      data: validatedOptions.map((option) => ({
        bookingId: booking.id,
        proposedDateTime: option.proposedDateTime,
        reasoning: option.reasoning,
        confidence: option.confidence,
        metadata: {
          aiModel: AI_MODEL,
          generatedAt: new Date().toISOString(),
          weatherSafe: option.weatherSafe,
          instructorAvailable: option.instructorAvailable,
          originalViolations: payload.violationSummary,
        },
      })),
    });

    // Update booking status to AWAITING_RESPONSE
    await tx.booking.update({
      where: { id: booking.id },
      data: { status: 'AWAITING_RESPONSE' },
    });

    // Create notifications for both student and instructor
    await tx.notification.createMany({
      data: [
        {
          userId: booking.studentId,
          type: 'RESCHEDULE_SUGGESTION',
          channel: 'IN_APP',
          title: 'Reschedule Suggestions Available',
          message: `We've generated ${validatedOptions.length} alternative time slots for your flight lesson. Please review and select your preferred option.`,
          metadata: {
            bookingId: booking.id,
            eventType: 'RESCHEDULE_SUGGESTIONS',
            suggestionsCount: validatedOptions.length,
            originalDateTime: booking.scheduledStart.toISOString(),
          },
          deliveredAt: new Date(),
        },
        {
          userId: booking.instructorId,
          type: 'RESCHEDULE_SUGGESTION',
          channel: 'IN_APP',
          title: 'Reschedule Suggestions Sent',
          message: `${validatedOptions.length} reschedule suggestions have been sent to ${booking.student.name} for the lesson originally scheduled on ${booking.scheduledStart.toLocaleString()}.`,
          metadata: {
            bookingId: booking.id,
            eventType: 'RESCHEDULE_SUGGESTIONS',
            studentName: booking.student.name,
            suggestionsCount: validatedOptions.length,
          },
          deliveredAt: new Date(),
        },
      ],
    });
  });

  console.log(`Persisted ${validatedOptions.length} suggestions and notifications for booking ${booking.id}`);

  // 7. Publish notification to SNS
  if (SNS_TOPIC_ARN) {
    await publishNotification(snsClient, {
      bookingId: booking.id,
      studentId: booking.studentId,
      instructorId: booking.instructorId,
      originalDateTime: booking.scheduledStart.toISOString(),
      suggestionsCount: validatedOptions.length,
      triggeredAt: new Date().toISOString(),
    });
  } else {
    console.warn('SNS_TOPIC_ARN not set, skipping notification publish');
  }
}

/**
 * Parse and validate SQS message payload
 */
function parsePayload(record: SQSRecord): WeatherConflictPayload {
  try {
    return JSON.parse(record.body) as WeatherConflictPayload;
  } catch (error) {
    throw new Error(`Failed to parse SQS message body: ${error}`);
  }
}

/**
 * Try to parse payload without throwing (for error reporting)
 */
function tryParsePayload(record: SQSRecord): WeatherConflictPayload | null {
  try {
    return JSON.parse(record.body) as WeatherConflictPayload;
  } catch {
    return null;
  }
}

/**
 * Generate reschedule suggestions using GPT-4
 */
async function generateRescheduleSuggestions(
  context: RescheduleContext
): Promise<Array<{ dateTime: Date; reasoning: string; confidence: number }>> {
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not configured');
  }

  const prompt = buildPrompt(context);

  const startTime = Date.now();

  try {
    const { text } = await generateText({
      model: openai(AI_MODEL),
      prompt,
      temperature: 0.7,
      maxTokens: 1000,
    });

    const processingTime = Date.now() - startTime;
    console.log('AI response received', { processingTime, model: AI_MODEL });

    // Parse and validate AI response
    const parsed = parseAIResponse(text);

    return parsed.suggestions.map((s) => ({
      dateTime: parseISO(s.dateTime),
      reasoning: s.reasoning,
      confidence: s.confidence,
    }));
  } catch (error) {
    console.error('Failed to generate AI suggestions:', error);

    // Fallback: Use heuristic approach
    console.log('Falling back to heuristic suggestions');
    return generateHeuristicSuggestions(context);
  }
}

/**
 * Build structured prompt for GPT-4
 */
function buildPrompt(context: RescheduleContext): string {
  const { booking, violations, instructorAvailability } = context;

  const originalDateTime = booking.scheduledStart.toISOString();
  const searchStart = startOfDay(addDays(new Date(), 1)).toISOString();
  const searchEnd = startOfDay(addDays(new Date(), SEARCH_WINDOW_DAYS)).toISOString();

  return `You are an AI assistant helping to reschedule a flight training lesson that was cancelled due to weather conditions.

ORIGINAL BOOKING:
- Student Training Level: ${booking.trainingLevel}
- Departure: ${booking.departureLocation}
- Arrival: ${booking.arrivalLocation}
- Original Date/Time: ${originalDateTime}
- Duration: ${booking.duration} minutes
- Weather Violations: ${violations.join(', ')}

INSTRUCTOR AVAILABILITY:
${JSON.stringify(instructorAvailability, null, 2)}

TASK:
Generate ${MAX_SUGGESTIONS} alternative date/time suggestions within the next ${SEARCH_WINDOW_DAYS} days (between ${searchStart} and ${searchEnd}).

REQUIREMENTS:
1. Each suggestion should be during instructor's available hours
2. Consider weather patterns (avoid same time of day if weather violations were time-specific)
3. Provide clear reasoning for each suggestion
4. Assign a confidence score (0.0 to 1.0) based on likelihood of success
5. Suggestions should be at least 24 hours in the future

OUTPUT FORMAT (JSON):
{
  "suggestions": [
    {
      "dateTime": "ISO 8601 date-time string",
      "reasoning": "Brief explanation why this time slot is recommended",
      "confidence": 0.85
    }
  ]
}

Generate exactly ${MAX_SUGGESTIONS} suggestions as a valid JSON object:`;
}

/**
 * Parse and validate AI text response
 */
function parseAIResponse(text: string): AIRescheduleResponse {
  try {
    // Try to extract JSON from markdown code blocks if present
    const jsonMatch = text.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/) || text.match(/(\{[\s\S]*\})/);
    const jsonText = jsonMatch ? jsonMatch[1] : text;

    const parsed = JSON.parse(jsonText);
    const validated = aiResponseSchema.parse(parsed);

    return validated;
  } catch (error) {
    console.error('Failed to parse AI response:', error);
    console.error('Raw response:', text);
    throw new Error(`Invalid AI response format: ${error}`);
  }
}

/**
 * Fallback heuristic suggestions when AI fails
 */
function generateHeuristicSuggestions(
  context: RescheduleContext
): Array<{ dateTime: Date; reasoning: string; confidence: number }> {
  const { booking } = context;
  const originalStart = booking.scheduledStart;

  // Generate suggestions: +2 days, +3 days, +7 days at same time
  const suggestions = [
    {
      dateTime: addDays(originalStart, 2),
      reasoning: 'Same time 2 days later, allowing weather pattern to pass',
      confidence: 0.7,
    },
    {
      dateTime: addDays(originalStart, 3),
      reasoning: 'Same time 3 days later, increased likelihood of better weather',
      confidence: 0.75,
    },
    {
      dateTime: addDays(originalStart, 7),
      reasoning: 'Same time next week, highest likelihood of different weather pattern',
      confidence: 0.8,
    },
  ];

  return suggestions.slice(0, MAX_SUGGESTIONS);
}

/**
 * Validate AI suggestions against instructor availability and weather forecast
 */
async function validateSuggestions(
  suggestions: Array<{ dateTime: Date; reasoning: string; confidence: number }>,
  context: RescheduleContext,
  prisma: ReturnType<typeof getPrismaClient>
): Promise<RescheduleOption[]> {
  const validatedOptions: RescheduleOption[] = [];

  for (const suggestion of suggestions) {
    // Skip low-confidence suggestions
    if (suggestion.confidence < MIN_CONFIDENCE_THRESHOLD) {
      console.log(`Skipping low-confidence suggestion: ${suggestion.confidence}`);
      continue;
    }

    // Check instructor availability
    const instructorAvailable = checkInstructorAvailability(
      suggestion.dateTime,
      context.booking.duration,
      context.instructorAvailability as any
    );

    if (!instructorAvailable) {
      console.log(`Instructor not available at ${suggestion.dateTime.toISOString()}`);
      continue;
    }

    // Check weather forecast (if API key available)
    let weatherSafe = true;

    if (OPENWEATHERMAP_API_KEY) {
      try {
        weatherSafe = await checkWeatherForecast(
          suggestion.dateTime,
          context.booking,
          prisma
        );
      } catch (error) {
        console.warn('Weather forecast check failed, assuming safe:', error);
        // Default to safe if weather check fails (optimistic approach)
      }
    }

    validatedOptions.push({
      proposedDateTime: suggestion.dateTime,
      reasoning: suggestion.reasoning,
      confidence: suggestion.confidence,
      weatherSafe,
      instructorAvailable,
    });
  }

  return validatedOptions;
}

/**
 * Check if instructor is available at the proposed time
 */
function checkInstructorAvailability(
  proposedDateTime: Date,
  durationMinutes: number,
  availability: any
): boolean {
  if (!availability || typeof availability !== 'object') {
    // If no availability data, assume available (optimistic)
    return true;
  }

  // TODO: Implement detailed availability checking based on weeklySchedule and exceptions
  // For now, simplified check assuming availability exists

  const dayOfWeek = proposedDateTime.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
  const weeklySchedule = availability.weeklySchedule || {};

  if (!weeklySchedule[dayOfWeek]) {
    return false;
  }

  // Check if proposed time falls within any available slot
  const proposedHour = proposedDateTime.getHours();
  const proposedMinutes = proposedDateTime.getMinutes();
  const proposedTimeInMinutes = proposedHour * 60 + proposedMinutes;
  const endTimeInMinutes = proposedTimeInMinutes + durationMinutes;

  const daySlots = weeklySchedule[dayOfWeek];
  if (!Array.isArray(daySlots)) {
    return false;
  }

  return daySlots.some((slot: any) => {
    const [startHour, startMin] = slot.start.split(':').map(Number);
    const [endHour, endMin] = slot.end.split(':').map(Number);

    const slotStartMinutes = startHour * 60 + startMin;
    const slotEndMinutes = endHour * 60 + endMin;

    return proposedTimeInMinutes >= slotStartMinutes && endTimeInMinutes <= slotEndMinutes;
  });
}

/**
 * Check weather forecast for proposed time
 */
async function checkWeatherForecast(
  proposedDateTime: Date,
  booking: RescheduleContext['booking'],
  prisma: ReturnType<typeof getPrismaClient>
): Promise<boolean> {
  if (!OPENWEATHERMAP_API_KEY) {
    return true; // Optimistic if no API key
  }

  const weatherClient = createWeatherClient(OPENWEATHERMAP_API_KEY);

  // Calculate waypoints for the proposed flight
  const waypoints = calculateWaypoints(
    booking.departureLocation,
    booking.arrivalLocation,
    proposedDateTime,
    booking.duration
  );

  // Fetch weather forecast
  const weatherData = await weatherClient.getWeatherForWaypoints(waypoints);

  // Evaluate route
  const waypointsWithWeather = waypoints.map((waypoint, index) => ({
    waypoint,
    weather: weatherData[index],
  }));

  const routeEvaluation = evaluateRoute(
    waypointsWithWeather,
    booking.trainingLevel as TrainingLevel
  );

  return routeEvaluation.safe;
}

/**
 * Publish notification to SNS topic
 */
async function publishNotification(
  snsClient: SNSClient,
  payload: RescheduleNotificationPayload
): Promise<void> {
  if (!SNS_TOPIC_ARN) {
    throw new Error('SNS_TOPIC_ARN is not configured');
  }

  const command = new PublishCommand({
    TopicArn: SNS_TOPIC_ARN,
    Message: JSON.stringify(payload),
    Subject: 'Flight Lesson Reschedule Suggestions Available',
    MessageAttributes: {
      bookingId: {
        DataType: 'String',
        StringValue: payload.bookingId,
      },
      studentId: {
        DataType: 'String',
        StringValue: payload.studentId,
      },
      eventType: {
        DataType: 'String',
        StringValue: 'RESCHEDULE_SUGGESTIONS',
      },
    },
  });

  try {
    const response = await snsClient.send(command);
    console.log('Published notification to SNS', {
      messageId: response.MessageId,
      bookingId: payload.bookingId,
    });
  } catch (error) {
    console.error('Failed to publish to SNS:', error);
    throw error;
  }
}
