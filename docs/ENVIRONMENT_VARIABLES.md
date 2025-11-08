# Environment Variables Reference

This document describes all environment variables required for the Flight Lesson Rescheduler application.

## Table of Contents
- [Application (Next.js)](#application-nextjs)
- [Lambda Functions](#lambda-functions)
- [Infrastructure (CDK)](#infrastructure-cdk)
- [CI/CD (GitHub Actions)](#cicd-github-actions)
- [Quick Setup Guide](#quick-setup-guide)

---

## Application (Next.js)

### Required Variables

#### Database
```bash
# PostgreSQL connection string
DATABASE_URL="postgresql://user:password@host:port/database"
# Example (development):
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/flight_rescheduler_dev"
```

#### Redis
```bash
# Redis connection URL for SSE and caching
REDIS_URL="redis://host:port"
# Example (development):
REDIS_URL="redis://localhost:6379"

# Optional: Redis password
REDIS_PASSWORD="your_password_here"
```

#### AWS Amplify Auth (Cognito)
```bash
# Amplify configuration (public - safe for client-side)
NEXT_PUBLIC_AMPLIFY_USER_POOL_ID="us-east-1_XXXXXXXXX"
NEXT_PUBLIC_AMPLIFY_USER_POOL_CLIENT_ID="xxxxxxxxxxxxxxxxxxxxxxxxxx"
NEXT_PUBLIC_AMPLIFY_REGION="us-east-1"
NEXT_PUBLIC_AMPLIFY_OAUTH_DOMAIN="your-app.auth.us-east-1.amazoncognito.com"
NEXT_PUBLIC_AMPLIFY_OAUTH_REDIRECT_SIGN_IN="http://localhost:3000/auth/callback"
NEXT_PUBLIC_AMPLIFY_OAUTH_REDIRECT_SIGN_OUT="http://localhost:3000/"
```

#### API Keys
```bash
# OpenWeatherMap API (server-side only)
OPENWEATHERMAP_API_KEY="your_api_key_here"
```

### Optional Variables

```bash
# Node environment
NODE_ENV="development" # or "production", "test"

# Application URL
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# Enable debug logging
DEBUG="flight-rescheduler:*"

# Sentry DSN (optional monitoring)
SENTRY_DSN="https://xxx@xxx.ingest.sentry.io/xxx"
NEXT_PUBLIC_SENTRY_DSN="https://xxx@xxx.ingest.sentry.io/xxx"
```

---

## Lambda Functions

### Weather Monitor Lambda

```bash
# Database connection
DATABASE_URL="postgresql://user:password@host:port/database"

# Weather API
OPENWEATHERMAP_API_KEY="your_api_key_here"

# SQS Queue URL (auto-injected by CDK)
SQS_QUEUE_URL="https://sqs.us-east-1.amazonaws.com/123456789012/weather-alerts-queue-production"

# AWS Region (auto-injected by CDK)
AWS_REGION="us-east-1"

# Environment
NODE_ENV="production"
```

### AI Rescheduler Lambda

```bash
# Database connection
DATABASE_URL="postgresql://user:password@host:port/database"

# OpenAI API for GPT-4
OPENAI_API_KEY="sk-..."

# Weather API (for forecast validation)
OPENWEATHERMAP_API_KEY="your_api_key_here"

# SNS Topic ARN (auto-injected by CDK)
SNS_TOPIC_ARN="arn:aws:sns:us-east-1:123456789012:reschedule-notifications-production"

# AWS Region (auto-injected by CDK)
AWS_REGION="us-east-1"

# Environment
NODE_ENV="production"
```

---

## Infrastructure (CDK)

### Deployment Context Variables

These are passed via `--context` flag or set as environment variables:

```bash
# Environment name
environment="development" # or "staging", "production"

# Database URL
databaseUrl="postgresql://..."

# API Keys
weatherApiKey="your_openweathermap_key"
openAIApiKey="sk-..."

# Optional: SNS Topic ARNs for alerts
alertTopicArn="arn:aws:sns:us-east-1:123456789012:ops-alerts"
notificationTopicArn="arn:aws:sns:us-east-1:123456789012:user-notifications"
```

### CDK Environment Variables

```bash
# AWS account and region (auto-detected or set explicitly)
CDK_DEFAULT_ACCOUNT="123456789012"
CDK_DEFAULT_REGION="us-east-1"

# AWS credentials
AWS_ACCESS_KEY_ID="AKIA..."
AWS_SECRET_ACCESS_KEY="..."
AWS_SESSION_TOKEN="..." # If using temporary credentials
```

---

## CI/CD (GitHub Actions)

### GitHub Secrets

Navigate to: Repository → Settings → Secrets and variables → Actions

#### AWS Credentials
```
AWS_ACCESS_KEY_ID              # Development/staging AWS access key
AWS_SECRET_ACCESS_KEY          # Development/staging AWS secret key
AWS_ACCESS_KEY_ID_PROD         # Production AWS access key
AWS_SECRET_ACCESS_KEY_PROD     # Production AWS secret key
```

#### Database URLs
```
DEV_DATABASE_URL               # Development database connection string
PROD_DATABASE_URL              # Production database connection string
```

#### API Keys
```
OPENWEATHERMAP_API_KEY         # Weather API key (shared across envs)
OPENAI_API_KEY                 # OpenAI API key (shared across envs)
```

#### Optional Integrations
```
CODECOV_TOKEN                  # Codecov.io upload token (optional)
SENTRY_AUTH_TOKEN              # Sentry release token (optional)
SLACK_WEBHOOK_URL              # Slack notifications (optional)
```

---

## Quick Setup Guide

### 1. Local Development Setup

Create `.env` file in project root:

```bash
cp .env.example .env
```

Edit `.env`:

```bash
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/flight_rescheduler_dev

# Redis
REDIS_URL=redis://localhost:6379

# APIs
OPENWEATHERMAP_API_KEY=your_key_here
OPENAI_API_KEY=sk-your_key_here

# AWS (for LocalStack)
AWS_REGION=us-east-1
AWS_ENDPOINT_URL=http://localhost:4566
AWS_ACCESS_KEY_ID=test
AWS_SECRET_ACCESS_KEY=test

# Amplify (development)
NEXT_PUBLIC_AMPLIFY_USER_POOL_ID=us-east-1_XXXXXXXXX
NEXT_PUBLIC_AMPLIFY_USER_POOL_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx
NEXT_PUBLIC_AMPLIFY_REGION=us-east-1
```

### 2. Running with Docker Compose

The `docker-compose.yml` automatically sets up Postgres, Redis, and LocalStack:

```bash
docker compose up -d
```

### 3. GitHub Actions Setup

Add secrets to your repository:

1. Go to repository Settings → Secrets → Actions
2. Click "New repository secret"
3. Add each required secret from the [CI/CD section](#cicd-github-actions)

### 4. CDK Deployment Setup

For initial deployment:

```bash
# Export required variables
export DATABASE_URL="postgresql://..."
export OPENWEATHERMAP_API_KEY="..."
export OPENAI_API_KEY="sk-..."

# Deploy
cd infrastructure
npx cdk deploy --all --context environment=development
```

---

## Security Best Practices

### DO NOT

❌ Commit `.env` files to version control
❌ Share API keys in Slack/email/tickets
❌ Use production credentials in development
❌ Hardcode secrets in code
❌ Log sensitive environment variables

### DO

✅ Use AWS Secrets Manager for production secrets
✅ Rotate API keys regularly
✅ Use different credentials per environment
✅ Set up least-privilege IAM policies
✅ Enable CloudTrail for secret access logging
✅ Use `.env.example` as template (without real values)

### Using AWS Secrets Manager (Production)

Instead of environment variables, use Secrets Manager:

```typescript
// lib/server/secrets.ts
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

const client = new SecretsManagerClient({ region: 'us-east-1' });

export async function getSecret(secretName: string): Promise<string> {
  const response = await client.send(
    new GetSecretValueCommand({ SecretId: secretName })
  );
  return response.SecretString!;
}

// Usage
const dbUrl = await getSecret('prod/database-url');
const openAIKey = await getSecret('prod/openai-api-key');
```

---

## Troubleshooting

### "Missing required environment variable"

**Cause**: Variable not set or misspelled

**Solution**:
1. Check `.env` file exists and is in correct location
2. Verify variable name matches exactly (case-sensitive)
3. Restart dev server after adding new variables
4. For Next.js public vars, ensure `NEXT_PUBLIC_` prefix

### "Database connection failed"

**Cause**: Invalid `DATABASE_URL` or database not running

**Solution**:
```bash
# Check if Postgres is running
docker compose ps postgres

# Test connection manually
psql "${DATABASE_URL}"

# Verify connection string format
# postgresql://[user[:password]@][host][:port][/dbname]
```

### "OpenAI API authentication failed"

**Cause**: Invalid or expired `OPENAI_API_KEY`

**Solution**:
1. Verify key at https://platform.openai.com/api-keys
2. Check for extra whitespace in key
3. Ensure sufficient API credits
4. Test with curl:
```bash
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer ${OPENAI_API_KEY}"
```

### "Amplify authentication not working"

**Cause**: Missing or incorrect Amplify configuration

**Solution**:
1. Verify all `NEXT_PUBLIC_AMPLIFY_*` variables are set
2. Check User Pool exists in AWS Console
3. Ensure redirect URLs match exactly
4. Clear browser cache and cookies

---

## Environment Variable Checklist

Use this checklist when setting up a new environment:

### Development
- [ ] `DATABASE_URL` (local Postgres)
- [ ] `REDIS_URL` (local Redis)
- [ ] `OPENWEATHERMAP_API_KEY`
- [ ] `OPENAI_API_KEY`
- [ ] `NEXT_PUBLIC_AMPLIFY_*` (development Cognito)

### Staging
- [ ] `DATABASE_URL` (staging RDS)
- [ ] `REDIS_URL` (staging ElastiCache)
- [ ] `OPENWEATHERMAP_API_KEY`
- [ ] `OPENAI_API_KEY`
- [ ] `NEXT_PUBLIC_AMPLIFY_*` (staging Cognito)
- [ ] CDK context variables
- [ ] GitHub Actions secrets

### Production
- [ ] `DATABASE_URL` (production RDS - use Secrets Manager)
- [ ] `REDIS_URL` (production ElastiCache)
- [ ] `OPENWEATHERMAP_API_KEY` (production key - use Secrets Manager)
- [ ] `OPENAI_API_KEY` (production key - use Secrets Manager)
- [ ] `NEXT_PUBLIC_AMPLIFY_*` (production Cognito)
- [ ] CDK context variables
- [ ] GitHub Actions production secrets
- [ ] CloudWatch alarm SNS topics
- [ ] Sentry DSN (if using)

---

**Document Version**: 1.0
**Last Updated**: 2025-11-08
