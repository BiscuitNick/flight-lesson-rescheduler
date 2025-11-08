# Operations Runbook

## Table of Contents
- [Testing & Development](#testing--development)
- [CI/CD Workflows](#cicd-workflows)
- [Deployment](#deployment)
- [Monitoring & Alerting](#monitoring--alerting)
- [Incident Response](#incident-response)
- [Environment Variables](#environment-variables)

---

## Testing & Development

### Running Tests Locally

#### Unit Tests
```bash
# Run all unit tests across all packages
npm run test

# Run unit tests with coverage
npm run test -- --coverage

# Run unit tests in watch mode (for development)
npm run test:unit:watch --workspace=packages/app

# Run tests for specific package
npm run test --workspace=packages/weather-lib
```

#### E2E Tests
```bash
# Start required services
docker compose up -d postgres redis localstack

# Run database migrations
cd packages/app
npx prisma migrate deploy
npx prisma db seed

# Run E2E tests
npm run test:e2e

# Run E2E tests in UI mode (for debugging)
npm run test:e2e:ui

# Run E2E tests for specific file
npx playwright test tests/e2e/booking-flow.spec.ts
```

#### Coverage Thresholds
The project enforces the following coverage thresholds:
- **Lines**: 80%
- **Functions**: 80%
- **Branches**: 75%
- **Statements**: 80%

If coverage falls below these thresholds, the build will fail.

### Linting & Type Checking
```bash
# Run ESLint
npm run lint

# Fix auto-fixable linting issues
npm run lint -- --fix

# Run TypeScript type check
npm run typecheck

# Check code formatting
npm run format:check --workspace=packages/app

# Fix formatting issues
npm run format --workspace=packages/app
```

### Local Development
```bash
# Start all required Docker services
docker compose up -d

# Start Next.js dev server
npm run dev

# View database in Prisma Studio
npm run db:studio --workspace=packages/app

# Reset database (caution: destroys all data)
npm run db:reset --workspace=packages/app
```

---

## CI/CD Workflows

### GitHub Actions Pipeline

The CI/CD pipeline runs on:
- **Push to**: `main`, `develop`, `claude/**` branches
- **Pull requests to**: `main`, `develop`

#### Pipeline Stages

1. **Lint & Type Check** (~5 min)
   - ESLint validation
   - TypeScript type checking
   - Prettier formatting check

2. **Unit Tests** (~10 min)
   - Vitest across all packages
   - Coverage report generation
   - Coverage threshold enforcement

3. **E2E Tests** (~20 min)
   - Playwright tests with Postgres/Redis services
   - Screenshot/video capture on failure
   - Test report artifacts

4. **Build Lambdas** (~5 min)
   - Weather Monitor bundle
   - AI Rescheduler bundle
   - Artifact upload

5. **Deploy Dev** (auto on `main` push)
   - CDK stack deployment
   - Lambda function updates
   - Amplify deployment

6. **Deploy Prod** (manual approval required)
   - Production CDK deployment
   - Smoke tests
   - Deployment notifications

### Viewing Build Results

- **GitHub Actions**: Navigate to repository → Actions tab
- **Coverage Reports**: Uploaded to Codecov (if configured)
- **Test Reports**: Available as artifacts in each workflow run

---

## Deployment

### Prerequisites
```bash
# Install AWS CLI
brew install awscli  # macOS
# or
apt-get install awscli  # Linux

# Configure AWS credentials
aws configure

# Install CDK CLI
npm install -g aws-cdk
```

### Environment-Specific Deployments

#### Development
```bash
cd infrastructure
npm install

# Deploy both stacks
npx cdk deploy --all \
  --context environment=development \
  --context databaseUrl="${DEV_DATABASE_URL}" \
  --context weatherApiKey="${OPENWEATHERMAP_API_KEY}" \
  --context openAIApiKey="${OPENAI_API_KEY}"
```

#### Production
```bash
cd infrastructure
npm install

# Review changes first
npx cdk diff --context environment=production

# Deploy with approval
npx cdk deploy --all \
  --context environment=production \
  --context databaseUrl="${PROD_DATABASE_URL}" \
  --context weatherApiKey="${OPENWEATHERMAP_API_KEY}" \
  --context openAIApiKey="${OPENAI_API_KEY}"
```

### Rollback Procedure

```bash
# List recent CloudFormation stacks
aws cloudformation describe-stacks --region us-east-1

# Rollback to previous version
aws cloudformation rollback-stack \
  --stack-name FlightReschedulerWeatherMonitor-production

# Or redeploy previous CDK version
git checkout <previous-commit>
npx cdk deploy --all --context environment=production
```

### Database Migrations

```bash
# Production migration (caution!)
cd packages/app
DATABASE_URL="${PROD_DATABASE_URL}" npx prisma migrate deploy

# View migration status
DATABASE_URL="${PROD_DATABASE_URL}" npx prisma migrate status
```

---

## Monitoring & Alerting

### CloudWatch Dashboards

#### Weather Monitor Dashboard
- **URL**: Output from CDK deployment or
  `https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#dashboards:name=weather-monitor-{env}`

**Key Metrics**:
- Lambda invocations (hourly spikes expected)
- Error rate (should be < 1%)
- Average duration (should be < 30s)
- SQS queue depth (alerts sent to AI Rescheduler)

#### AI Rescheduler Dashboard
- **URL**: `https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#dashboards:name=ai-rescheduler-{env}`

**Key Metrics**:
- Lambda invocations (triggered by weather alerts)
- Error rate (should be < 2%)
- Average duration (GPT-4 calls can take 10-30s)
- Throttles (indicates concurrency limit hit)
- SNS notifications published

### CloudWatch Alarms

| Alarm Name | Threshold | Action |
|------------|-----------|--------|
| `weather-monitor-errors-{env}` | >3 errors in 5 min | Check Lambda logs, verify API keys |
| `weather-monitor-duration-{env}` | Avg >90s | Optimize query, check DB performance |
| `weather-monitor-dlq-{env}` | >1 message | Investigate failed weather checks |
| `ai-rescheduler-errors-{env}` | >3 errors in 5 min | Check OpenAI API, verify prompts |
| `ai-rescheduler-throttles-{env}` | >5 throttles in 5 min | Increase concurrency limit or batch size |
| `ai-rescheduler-dlq-{env}` | >1 message | Investigate failed reschedule processing |

### Log Analysis

```bash
# View Weather Monitor logs
aws logs tail /aws/lambda/weather-monitor-production --follow

# Search for errors
aws logs filter-pattern /aws/lambda/weather-monitor-production --filter-pattern "ERROR"

# View AI Rescheduler logs
aws logs tail /aws/lambda/ai-rescheduler-production --follow

# Export logs for analysis
aws logs get-log-events \
  --log-group-name /aws/lambda/weather-monitor-production \
  --log-stream-name <stream-name> \
  --output json > logs.json
```

---

## Incident Response

### Common Issues

#### 1. Weather Monitor Lambda Timeouts

**Symptoms**: Duration alarm triggered, "Task timed out" errors

**Investigation**:
```bash
# Check recent invocation durations
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Duration \
  --dimensions Name=FunctionName,Value=weather-monitor-production \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Average,Maximum
```

**Resolution**:
1. Check database connection pool exhaustion
2. Verify OpenWeatherMap API response times
3. Consider increasing Lambda timeout or memory
4. Review recent booking volume spike

#### 2. AI Rescheduler High Error Rate

**Symptoms**: Error alarm triggered, DLQ messages accumulating

**Investigation**:
```bash
# Check error logs
aws logs filter-pattern /aws/lambda/ai-rescheduler-production \
  --filter-pattern "ERROR" \
  --start-time $(date -u -d '1 hour ago' +%s)000

# Inspect DLQ messages
aws sqs receive-message \
  --queue-url <dlq-url> \
  --max-number-of-messages 10
```

**Common Causes**:
- OpenAI API rate limits or outages
- Malformed weather data from upstream
- Database connection issues
- Invalid GPT-4 response format

**Resolution**:
1. Verify OpenAI API key and quota
2. Check upstream SQS message format
3. Review prompt changes in recent deployments
4. Manually reprocess DLQ messages after fix

#### 3. Database Connection Pool Exhaustion

**Symptoms**: "Too many connections" errors, slow queries

**Investigation**:
```bash
# Check active connections (from Prisma Studio or psql)
SELECT count(*) FROM pg_stat_activity;

# Identify long-running queries
SELECT pid, now() - query_start AS duration, query
FROM pg_stat_activity
WHERE state = 'active'
ORDER BY duration DESC;
```

**Resolution**:
1. Review Prisma connection pool settings
2. Terminate stuck connections if safe
3. Scale up database instance if needed
4. Add connection retry logic

#### 4. Missing Notifications

**Symptoms**: Users not receiving reschedule notifications

**Investigation**:
```bash
# Check SNS publish metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/SNS \
  --metric-name NumberOfMessagesPublished \
  --dimensions Name=TopicName,Value=reschedule-notifications-production \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum

# Check SSE endpoint health
curl -N https://your-app.com/api/notifications/stream \
  -H "Authorization: Bearer <token>"
```

**Resolution**:
1. Verify SNS topic subscriptions
2. Check Redis connection for SSE pubsub
3. Review notification service logs
4. Test SES email delivery

---

## Environment Variables

### Required Variables

#### Local Development (.env)
```bash
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/flight_rescheduler_dev

# Redis
REDIS_URL=redis://localhost:6379

# APIs
OPENWEATHERMAP_API_KEY=your_key_here
OPENAI_API_KEY=your_key_here

# AWS (for LocalStack testing)
AWS_REGION=us-east-1
AWS_ENDPOINT_URL=http://localhost:4566
```

#### GitHub Actions Secrets
```
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
AWS_ACCESS_KEY_ID_PROD
AWS_SECRET_ACCESS_KEY_PROD
DEV_DATABASE_URL
PROD_DATABASE_URL
OPENWEATHERMAP_API_KEY
OPENAI_API_KEY
CODECOV_TOKEN (optional)
```

#### CDK Deployment
```bash
# Development
export DATABASE_URL="postgresql://..."
export OPENWEATHERMAP_API_KEY="..."
export OPENAI_API_KEY="..."

# Production (use AWS Secrets Manager)
export DATABASE_URL="$(aws secretsmanager get-secret-value --secret-id prod/db-url --query SecretString --output text)"
export OPENAI_API_KEY="$(aws secretsmanager get-secret-value --secret-id prod/openai-key --query SecretString --output text)"
```

### Rotating Secrets

```bash
# Update Lambda environment variables
aws lambda update-function-configuration \
  --function-name weather-monitor-production \
  --environment Variables={OPENWEATHERMAP_API_KEY=new_key}

# Or redeploy via CDK with new values
npx cdk deploy --all --context weatherApiKey="${NEW_KEY}"
```

---

## Useful Commands Reference

```bash
# View all CloudWatch alarms
aws cloudwatch describe-alarms --state-value ALARM

# Get Lambda function details
aws lambda get-function --function-name weather-monitor-production

# List recent Lambda invocations
aws lambda list-functions --max-items 10

# Manually invoke Lambda for testing
aws lambda invoke \
  --function-name weather-monitor-production \
  --payload '{}' \
  --cli-binary-format raw-in-base64-out \
  response.json

# Check SQS queue depth
aws sqs get-queue-attributes \
  --queue-url <queue-url> \
  --attribute-names ApproximateNumberOfMessages

# View CDK diff before deploying
npx cdk diff --all --context environment=production
```

---

## Support Contacts

- **On-Call Engineer**: Slack #flight-rescheduler-oncall
- **DevOps Team**: devops@example.com
- **CloudWatch Alarms**: SNS → Slack #flight-rescheduler-alerts
- **Status Page**: https://status.example.com

---

**Document Version**: 1.0
**Last Updated**: 2025-11-08
**Maintained By**: DevOps Team
