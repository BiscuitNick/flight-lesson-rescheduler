import type { EventBridgeEvent } from 'aws-lambda';

// Lambda 1: Weather Monitor
// Triggered hourly by EventBridge to check weather for upcoming bookings

export async function handler(event: EventBridgeEvent<string, unknown>) {
  console.log('Weather Monitor Lambda triggered', event);

  // TODO (Task 6): Implement weather monitoring logic
  // 1. Fetch bookings within next 48h
  // 2. Calculate waypoints
  // 3. Check weather
  // 4. Update booking status
  // 5. Publish to SQS

  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'Weather check complete' }),
  };
}
