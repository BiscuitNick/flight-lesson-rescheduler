# AI Rescheduler Lambda

Lambda 2: Consumes SQS messages from Weather Monitor Lambda and generates AI-powered reschedule suggestions using GPT-4.

## Overview

This Lambda function is triggered by SQS messages when a flight lesson has weather conflicts. It:

1. Receives weather conflict payloads via SQS
2. Fetches booking details and instructor availability
3. Generates 3 reschedule suggestions using GPT-4
4. Validates suggestions against instructor availability and weather forecasts
5. Persists suggestions to the database
6. Updates booking status to `AWAITING_RESPONSE`
7. Publishes notifications via SNS

## Architecture

```
Weather Monitor Lambda → SQS Queue → AI Rescheduler Lambda → SNS Topic
                                              ↓
                                        Database (Prisma)
                                        - RescheduleLog
                                        - Booking status update
```

## Environment Variables

### Required

- `DATABASE_URL` - PostgreSQL connection string for Prisma
- `OPENAI_API_KEY` - OpenAI API key for GPT-4 access

### Optional

- `AWS_REGION` - AWS region (default: `us-east-1`)
- `AWS_ENDPOINT_URL` - LocalStack endpoint for local development
- `SNS_TOPIC_ARN` - SNS topic ARN for publishing notifications
- `OPENWEATHERMAP_API_KEY` - Weather API key for forecast validation
- `AI_MODEL` - OpenAI model to use (default: `gpt-4o`)

## Configuration

### Business Logic Constants

- `MAX_SUGGESTIONS` = 3 - Number of reschedule options to generate
- `SEARCH_WINDOW_DAYS` = 14 - Look ahead window for finding alternatives
- `MIN_CONFIDENCE_THRESHOLD` = 0.6 - Minimum AI confidence score to accept

## Input: SQS Message Payload

```typescript
{
  bookingId: string;
  studentId: string;
  instructorId: string;
  scheduledStart: string; // ISO date
  scheduledEnd: string; // ISO date
  departureLocation: string;
  arrivalLocation: string;
  trainingLevel: string;
  violationSummary: string[];
  overallStatus: 'SAFE' | 'MARGINAL' | 'UNSAFE';
  checkedAt: string; // ISO date
}
```

## Output: RescheduleLog Records

For each valid suggestion, creates a database record:

```typescript
{
  bookingId: string;
  proposedDateTime: DateTime;
  reasoning: string;
  confidence: number; // 0.0 to 1.0
  metadata: {
    aiModel: string;
    generatedAt: string;
    weatherSafe: boolean;
    instructorAvailable: boolean;
    originalViolations: string[];
  }
}
```

## AI Prompt Structure

The GPT-4 prompt includes:

- Original booking details (time, location, duration, training level)
- Weather violations that caused the cancellation
- Instructor availability patterns (weekly schedule + exceptions)
- Search window constraints (next 14 days)

GPT-4 returns JSON with:
- Alternative date/time
- Reasoning for the suggestion
- Confidence score (0.0 to 1.0)

## Validation Logic

Each AI suggestion is validated:

1. **Confidence Filter**: Reject suggestions below 0.6 confidence
2. **Instructor Availability**: Check against weekly schedule and exceptions
3. **Weather Forecast**: Verify proposed time has safe weather (optional, if API key provided)

## Fallback Behavior

If GPT-4 fails or returns invalid JSON, falls back to heuristic suggestions:

- +2 days at same time (confidence 0.7)
- +3 days at same time (confidence 0.75)
- +7 days at same time (confidence 0.8)

## Error Handling

- Processes SQS records in batch
- Individual record failures don't fail entire batch
- Errors logged with booking ID for debugging
- DLQ handles repeated failures (configured in infrastructure)

## Development

### Install Dependencies

```bash
npm install
```

### Build

```bash
npm run build
```

### Run Tests

```bash
npm test
npm run test:coverage
npm run test:watch
```

### Type Check

```bash
npm run typecheck
```

## Local Testing

### With LocalStack

```bash
# Set environment variables
export AWS_ENDPOINT_URL=http://localhost:4566
export DATABASE_URL=postgresql://...
export OPENAI_API_KEY=sk-...

# Send test SQS message
aws --endpoint-url=http://localhost:4566 sqs send-message \
  --queue-url http://localhost:4566/000000000000/reschedule-queue \
  --message-body '{"bookingId":"...",...}'
```

### Unit Tests

Tests mock all external dependencies (Prisma, AWS SDK, OpenAI) for fast, isolated testing.

## Monitoring & Observability

### CloudWatch Logs

Structured logging includes:
- Record count per invocation
- Processing time per booking
- AI model and response time
- Validation results
- Error details with booking IDs

### Metrics to Monitor

- Invocations per hour
- Success/failure rate
- Processing duration
- AI response time
- Validation success rate
- SNS publish failures

### Alarms

Recommended CloudWatch alarms:
- Lambda errors > 3 in 5 minutes
- Duration > 2 minutes
- AI API failures > 5%
- SNS publish failures > 0

## Deployment

Built artifact: `dist/index.js` (bundled with esbuild)

### Lambda Configuration

- Runtime: Node.js 20
- Handler: `index.handler`
- Memory: 512 MB (adjust based on load)
- Timeout: 2 minutes (allows for AI API latency)
- Environment: Set all required env vars
- IAM Permissions:
  - SQS:ReceiveMessage, DeleteMessage
  - SNS:Publish
  - VPC access to RDS (if Prisma connects to private DB)

### Event Source Mapping

- SQS Queue: Connected to Weather Monitor Lambda output
- Batch size: 10 records
- Visibility timeout: 5 minutes
- DLQ: Separate queue for failed messages
- Retry policy: 3 retries with exponential backoff

## Future Enhancements

- [ ] ML model for predicting optimal reschedule times based on historical data
- [ ] Multi-instructor suggestions when primary instructor unavailable
- [ ] Cost optimization: Cache instructor availability in Redis
- [ ] Advanced availability checking: Account for existing bookings, not just weekly patterns
- [ ] Weather pattern learning: Avoid times historically prone to specific violations
- [ ] Student preferences: Consider preferred times from student profile

## Related Components

- **Weather Monitor Lambda** (`packages/functions/weather-monitor`) - Upstream producer
- **Weather Library** (`packages/weather-lib`) - Shared weather evaluation logic
- **Next.js App** (`packages/app`) - Frontend for displaying suggestions to users

## Task Master Reference

This implementation completes Task 7 and its subtasks:

- [x] 7.1: Lambda package and SQS trigger configuration
- [x] 7.2: Handler scaffolding and booking data retrieval
- [x] 7.3: GPT-4 prompt generation and response validation
- [x] 7.4: Persist reschedule logs and update booking status
- [x] 7.5: Publish SNS notifications
- [x] 7.6: Automated tests and LocalStack integration coverage
