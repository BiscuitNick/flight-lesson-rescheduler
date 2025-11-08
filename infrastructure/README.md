# Infrastructure

AWS CDK infrastructure for the Flight Lesson Rescheduler system.

## Overview

This directory contains AWS CDK code to provision:

- **Weather Monitor Lambda** - Hourly weather checking for bookings
- **EventBridge Rule** - Hourly trigger for the Lambda
- **SQS Queue** - Weather alerts queue for AI rescheduler
- **Dead Letter Queue** - Failed message handling
- **CloudWatch Dashboard** - Monitoring and metrics
- **CloudWatch Alarms** - Error and performance alerts
- **IAM Roles & Policies** - Least-privilege access

## Prerequisites

- Node.js 20+
- AWS CLI configured
- AWS CDK CLI (`npm install -g aws-cdk`)
- AWS account with appropriate permissions

## Setup

```bash
# Install dependencies
npm install

# Bootstrap CDK (first time only)
cdk bootstrap aws://ACCOUNT-ID/REGION
```

## Configuration

Set environment variables or CDK context:

```bash
export DATABASE_URL="postgresql://user:pass@host:5432/db"
export OPENWEATHERMAP_API_KEY="your-api-key"
export ALERT_TOPIC_ARN="arn:aws:sns:us-east-1:123456789012:alerts"  # Optional
```

Or use CDK context:

```bash
cdk deploy -c databaseUrl="..." -c weatherApiKey="..." -c environment="production"
```

## Deployment

### Development Environment

```bash
# Synthesize CloudFormation template
npm run synth

# Preview changes
npm run diff

# Deploy
npm run deploy
```

### Production Environment

```bash
cdk deploy -c environment=production
```

## Stack Outputs

After deployment, the stack outputs:

- `WeatherQueueUrl` - SQS queue URL for weather alerts
- `WeatherQueueArn` - SQS queue ARN
- `WeatherMonitorLambdaArn` - Lambda function ARN
- `DashboardUrl` - CloudWatch Dashboard URL

## Monitoring

### CloudWatch Dashboard

View metrics:
- Lambda invocations, errors, duration
- SQS queue depth and DLQ messages

Access via the `DashboardUrl` output.

### CloudWatch Alarms

Three alarms are configured:

1. **Error Alarm** - Triggers when Lambda has >3 errors in 5 minutes
2. **Duration Alarm** - Triggers when average duration >90 seconds
3. **DLQ Alarm** - Triggers when any message lands in DLQ

If `ALERT_TOPIC_ARN` is provided, alarms publish to SNS.

### CloudWatch Logs

Lambda logs are retained for 7 days and include:
- Booking processing details
- Weather check results
- SQS publishing confirmations
- Error stack traces

## Cost Estimation

Typical monthly costs (us-east-1, development environment):

- Lambda: ~$0.20 (720 invocations/month @ 512MB, 30s avg)
- SQS: ~$0.01 (minimal messages)
- CloudWatch Logs: ~$0.50 (1GB/month)
- **Total: ~$1/month**

Production costs will scale with:
- Number of bookings
- Lambda duration (depends on weather API latency)
- SQS message volume

## Cleanup

To remove all resources:

```bash
npm run destroy
```

**Warning**: This will delete the SQS queue and all messages.

## Architecture Diagram

```
┌─────────────────┐
│  EventBridge    │ Hourly cron trigger
│  Rule           │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Weather        │
│  Monitor        │ Processes bookings
│  Lambda         │ Checks weather
└────────┬────────┘
         │
         ├──────► PostgreSQL (via Prisma)
         │
         ▼
┌─────────────────┐
│  SQS Queue      │ Weather conflicts
│  (with DLQ)     │
└────────┬────────┘
         │
         ▼
     AI Rescheduler Lambda (Task 7)
```

## Security

- Lambda runs with minimal IAM permissions
- SQS encryption at rest (optional, enable in stack)
- Database credentials via environment variables
- VPC support (configure in stack for production)

## Troubleshooting

### CDK Synthesis Errors

```bash
# Check TypeScript compilation
npm run build

# Validate CDK context
cdk context
```

### Deployment Failures

- Verify AWS credentials: `aws sts get-caller-identity`
- Check CDK bootstrap: `cdk bootstrap`
- Review CloudFormation console for detailed errors

### Lambda Not Triggering

- Verify EventBridge rule is enabled
- Check Lambda permissions in IAM console
- Review CloudWatch Logs for invocation attempts

## Development

### Adding New Infrastructure

1. Edit `lib/weather-monitor-stack.ts`
2. Run `npm run build`
3. Test with `npm run synth`
4. Deploy with `npm run deploy`

### Testing Infrastructure Code

```bash
# CDK comes with built-in assertion library
npm install --save-dev @aws-cdk/assertions
```

Create tests in `lib/__tests__/` directory.

## Related Documentation

- [AWS CDK Documentation](https://docs.aws.amazon.com/cdk/)
- [Lambda Best Practices](https://docs.aws.amazon.com/lambda/latest/dg/best-practices.html)
- [EventBridge Scheduler](https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-create-rule-schedule.html)
