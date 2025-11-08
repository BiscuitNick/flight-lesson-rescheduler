/**
 * Unit tests for Weather Monitor Lambda
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { EventBridgeEvent } from 'aws-lambda';

// Mock dependencies
vi.mock('../prisma', () => ({
  getPrismaClient: vi.fn(() => mockPrisma),
  disconnectPrisma: vi.fn(),
}));

vi.mock('@flight-rescheduler/weather-lib', () => ({
  createWeatherClient: vi.fn(() => mockWeatherClient),
  calculateWaypoints: vi.fn(() => mockWaypoints),
  evaluateRoute: vi.fn(() => mockRouteEvaluation),
  getViolationReasons: vi.fn(() => ['Waypoint 1: Visibility too low']),
}));

vi.mock('@aws-sdk/client-sqs', () => ({
  SQSClient: vi.fn(() => mockSQSClient),
  SendMessageCommand: vi.fn((params) => params),
}));

// Mock implementations
const mockPrisma = {
  booking: {
    findMany: vi.fn(),
    update: vi.fn(),
  },
  weatherCheck: {
    create: vi.fn(),
  },
};

const mockWeatherClient = {
  getWeatherForWaypoints: vi.fn(),
};

const mockSQSClient = {
  send: vi.fn(),
};

const mockWaypoints = [
  {
    lat: 40.7128,
    lon: -74.006,
    timestamp: new Date('2025-11-08T10:00:00Z'),
  },
  {
    lat: 40.7589,
    lon: -73.9851,
    timestamp: new Date('2025-11-08T10:30:00Z'),
  },
];

const mockRouteEvaluation = {
  safe: false,
  overallStatus: 'UNSAFE' as const,
  waypoints: [
    {
      waypoint: mockWaypoints[0],
      weather: {
        visibility: 1.0,
        ceiling: 500,
        windSpeed: 15,
        windGust: 20,
        conditions: ['Rain'],
      },
      safe: false,
      violations: [
        {
          type: 'VISIBILITY' as const,
          reason: 'Visibility too low',
          actual: 1.0,
          required: 3.0,
        },
      ],
    },
  ],
  violationSummary: ['VISIBILITY: 1 waypoint'],
};

describe('Weather Monitor Lambda', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Set required environment variables
    process.env.OPENWEATHERMAP_API_KEY = 'test-api-key';
    process.env.SQS_QUEUE_URL = 'http://localhost:4566/000000000000/test-queue';
    process.env.AWS_REGION = 'us-east-1';
  });

  it('should process bookings and identify weather conflicts', async () => {
    // Arrange
    const mockBooking = {
      id: 'booking-123',
      studentId: 'student-123',
      instructorId: 'instructor-123',
      departureLocation: '40.7128,-74.006',
      arrivalLocation: '40.7589,-73.9851',
      scheduledStart: new Date('2025-11-08T10:00:00Z'),
      scheduledEnd: new Date('2025-11-08T12:00:00Z'),
      duration: 120,
      status: 'SCHEDULED',
      student: {
        id: 'student-123',
        email: 'student@example.com',
        trainingLevel: 'STUDENT_PILOT',
      },
      instructor: {
        id: 'instructor-123',
        email: 'instructor@example.com',
      },
    };

    mockPrisma.booking.findMany.mockResolvedValue([mockBooking]);
    mockPrisma.booking.update.mockResolvedValue(mockBooking);
    mockPrisma.weatherCheck.create.mockResolvedValue({ id: 'check-123' });
    mockWeatherClient.getWeatherForWaypoints.mockResolvedValue([
      {
        visibility: 1.0,
        ceiling: 500,
        windSpeed: 15,
        windGust: 20,
        conditions: ['Rain'],
      },
    ]);
    mockSQSClient.send.mockResolvedValue({ MessageId: 'msg-123' });

    const event: EventBridgeEvent<string, unknown> = {
      version: '0',
      id: 'event-123',
      'detail-type': 'Scheduled Event',
      source: 'aws.events',
      account: '123456789012',
      time: '2025-11-08T09:00:00Z',
      region: 'us-east-1',
      resources: [],
      detail: {},
    };

    // Dynamically import handler after mocks are set up
    const { handler } = await import('../index');

    // Act
    const result = await handler(event);

    // Assert
    expect(result.statusCode).toBe(200);
    expect(mockPrisma.booking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'SCHEDULED',
        }),
      })
    );
    expect(mockPrisma.booking.update).toHaveBeenCalledWith({
      where: { id: 'booking-123' },
      data: { status: 'WEATHER_HOLD' },
    });
    expect(mockPrisma.weatherCheck.create).toHaveBeenCalled();
    expect(mockSQSClient.send).toHaveBeenCalled();
  });

  it('should skip bookings without training level', async () => {
    // Arrange
    const mockBooking = {
      id: 'booking-123',
      studentId: 'student-123',
      instructorId: 'instructor-123',
      departureLocation: '40.7128,-74.006',
      arrivalLocation: '40.7589,-73.9851',
      scheduledStart: new Date('2025-11-08T10:00:00Z'),
      scheduledEnd: new Date('2025-11-08T12:00:00Z'),
      duration: 120,
      status: 'SCHEDULED',
      student: {
        id: 'student-123',
        email: 'student@example.com',
        trainingLevel: null, // No training level
      },
      instructor: {
        id: 'instructor-123',
        email: 'instructor@example.com',
      },
    };

    mockPrisma.booking.findMany.mockResolvedValue([mockBooking]);

    const event: EventBridgeEvent<string, unknown> = {
      version: '0',
      id: 'event-123',
      'detail-type': 'Scheduled Event',
      source: 'aws.events',
      account: '123456789012',
      time: '2025-11-08T09:00:00Z',
      region: 'us-east-1',
      resources: [],
      detail: {},
    };

    const { handler } = await import('../index');

    // Act
    const result = await handler(event);

    // Assert
    expect(result.statusCode).toBe(200);
    expect(mockPrisma.booking.update).not.toHaveBeenCalled();
    expect(mockSQSClient.send).not.toHaveBeenCalled();
  });

  it('should not update booking status for safe weather', async () => {
    // Arrange
    const mockBooking = {
      id: 'booking-123',
      studentId: 'student-123',
      instructorId: 'instructor-123',
      departureLocation: '40.7128,-74.006',
      arrivalLocation: '40.7589,-73.9851',
      scheduledStart: new Date('2025-11-08T10:00:00Z'),
      scheduledEnd: new Date('2025-11-08T12:00:00Z'),
      duration: 120,
      status: 'SCHEDULED',
      student: {
        id: 'student-123',
        email: 'student@example.com',
        trainingLevel: 'PRIVATE_PILOT',
      },
      instructor: {
        id: 'instructor-123',
        email: 'instructor@example.com',
      },
    };

    // Mock safe evaluation
    const safeEvaluation = {
      ...mockRouteEvaluation,
      safe: true,
      overallStatus: 'SAFE' as const,
    };

    const { evaluateRoute } = await import('@flight-rescheduler/weather-lib');
    vi.mocked(evaluateRoute).mockReturnValue(safeEvaluation);

    mockPrisma.booking.findMany.mockResolvedValue([mockBooking]);
    mockPrisma.weatherCheck.create.mockResolvedValue({ id: 'check-123' });
    mockWeatherClient.getWeatherForWaypoints.mockResolvedValue([
      {
        visibility: 10.0,
        ceiling: 10000,
        windSpeed: 5,
        conditions: ['Clear'],
      },
    ]);

    const event: EventBridgeEvent<string, unknown> = {
      version: '0',
      id: 'event-123',
      'detail-type': 'Scheduled Event',
      source: 'aws.events',
      account: '123456789012',
      time: '2025-11-08T09:00:00Z',
      region: 'us-east-1',
      resources: [],
      detail: {},
    };

    const { handler } = await import('../index');

    // Act
    const result = await handler(event);

    // Assert
    expect(result.statusCode).toBe(200);
    expect(mockPrisma.weatherCheck.create).toHaveBeenCalled();
    expect(mockPrisma.booking.update).not.toHaveBeenCalled();
    expect(mockSQSClient.send).not.toHaveBeenCalled();
  });
});
