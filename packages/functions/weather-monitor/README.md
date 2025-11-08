# Weather Monitor Lambda

This Lambda function is triggered hourly by EventBridge to monitor weather conditions for upcoming flight lesson bookings.

## Overview

The Weather Monitor Lambda performs the following tasks:

1. **Fetches upcoming bookings** - Retrieves all SCHEDULED bookings within the next 48 hours
2. **Calculates flight waypoints** - Generates waypoints along the flight path
3. **Checks weather conditions** - Fetches weather data for each waypoint using OpenWeatherMap API
4. **Evaluates safety** - Compares weather against training level minimums
5. **Updates booking status** - Sets bookings to WEATHER_HOLD if unsafe conditions detected
6. **Creates weather check records** - Stores detailed weather evaluation in the database
7. **Publishes to SQS** - Sends weather conflicts to the AI Rescheduler queue

## Architecture

```
EventBridge (hourly) → Weather Monitor Lambda → Prisma/PostgreSQL
                                             ↓
                                          SQS Queue → AI Rescheduler Lambda
```

## Environment Variables

Required:
- `DATABASE_URL` - PostgreSQL connection string
- `OPENWEATHERMAP_API_KEY` - OpenWeatherMap API key
- `SQS_QUEUE_URL` - URL for the weather alerts SQS queue
- `AWS_REGION` - AWS region (default: us-east-1)

Optional:
- `AWS_ENDPOINT_URL` - For LocalStack testing
- `NODE_ENV` - Environment (development, staging, production)

## Development

### Install dependencies

```bash
npm install
```

### Build

```bash
npm run build
```

### Type check

```bash
npm run typecheck
```

### Run tests

```bash
# Run unit tests
npm test

# Watch mode
npm run test:watch

# With coverage
npm run test:coverage
```

## Testing

### Unit Tests

Unit tests are located in `src/__tests__/handler.test.ts` and use Vitest with mocked dependencies.

```bash
npm test
```

### LocalStack Integration Test

Test the Lambda locally using LocalStack:

```bash
# From project root
./scripts/test-weather-monitor-local.sh
```

This script:
1. Builds the Lambda
2. Creates SQS queue in LocalStack
3. Deploys Lambda to LocalStack
4. Invokes the Lambda with a test event
5. Checks SQS for published messages

## Deployment

### Using AWS CDK

From the infrastructure directory:

```bash
cd infrastructure
npm install

# Set environment variables or CDK context
export DATABASE_URL="postgresql://..."
export OPENWEATHERMAP_API_KEY="your-key"

# Synthesize CloudFormation template
npm run synth

# Deploy to AWS
npm run deploy
```

### Manual Deployment

1. Build the Lambda:
   ```bash
   npm run build
   ```

2. Create deployment package:
   ```bash
   zip -r weather-monitor.zip dist/ node_modules/
   ```

3. Deploy using AWS CLI or console

## Monitoring

The Lambda includes:
- **CloudWatch Logs** - Structured logging with Pino
- **CloudWatch Metrics** - Invocations, errors, duration
- **CloudWatch Alarms**:
  - Error rate > 3 failures in 5 minutes
  - Duration > 90 seconds average
  - DLQ messages > 0

## Error Handling

- Individual booking processing errors are logged but don't fail the entire Lambda
- SQS publishing failures are thrown and will trigger retry
- Database connection errors cause Lambda failure and retry
- Weather API rate limits are handled with exponential backoff

## Performance

- **Timeout**: 2 minutes
- **Memory**: 512 MB
- **Expected duration**: 10-30 seconds for typical load (10-50 bookings)
- **Cold start**: ~2-3 seconds

## Related Components

- **Weather Library** (`@flight-rescheduler/weather-lib`) - Shared weather evaluation logic
- **Prisma Schema** - Database models for Booking, WeatherCheck
- **AI Rescheduler Lambda** - Consumes SQS messages from this Lambda

## Troubleshooting

### Lambda timeouts

- Check CloudWatch Logs for slow weather API calls
- Consider increasing memory (more memory = faster CPU)
- Review database query performance

### No messages in SQS

- Verify SQS_QUEUE_URL environment variable
- Check CloudWatch Logs for "safe" weather evaluations
- Ensure bookings exist in the database

### Weather API errors

- Verify OPENWEATHERMAP_API_KEY is valid
- Check rate limits (free tier: 60 calls/minute)
- Review weather-lib caching configuration
