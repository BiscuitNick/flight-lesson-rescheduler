# Technical PRD: Weather Cancellation & AI Rescheduling System

**Organization:** Flight Schedule Pro  
**Category:** AI-Powered Flight Operations  
**Last Updated:** November 7, 2025  
**Version:** 2.0

---

## Executive Summary

An event-driven system that monitors weather conditions across flight paths, automatically detects conflicts with scheduled flight lessons, and uses AI to generate intelligent rescheduling options. The system considers student training levels, instructor availability, and weather minimums to ensure safe flight operations.

---

## Technical Stack

### Frontend & API
- **Framework:** Next.js 16.0.1 (App Router)
- **Language:** TypeScript 5.6.x
- **Styling:** Tailwind CSS 4.0
- **UI Components:** shadcn/ui (latest)
- **API Layer:** tRPC 11.0
- **State Management:** TanStack Query 5.84
- **Real-time:** Server-Sent Events (SSE)

### Backend & Infrastructure
- **Database:** PostgreSQL (AWS RDS) + Prisma ORM 5.x
- **AI/ML:** Vercel AI SDK 4.0 + OpenAI GPT-4
- **Cloud Services:** AWS Lambda, SQS, EventBridge, SES, SNS, RDS, Amplify
- **Authentication:** AWS Amplify Auth (Cognito)
- **Runtime:** Node.js 20.x

### Development Tools
- **Package Manager:** npm (with workspaces)
- **Monorepo Structure:** npm workspaces (4 packages)
- **Testing:** Vitest, Playwright
- **CI/CD:** GitHub Actions
- **Containerization:** Docker Compose
- **Code Quality:** ESLint, Prettier, Husky
- **Lambda Bundler:** esbuild

---

## System Architecture

### High-Level Flow

1. **Weather Monitoring (Hourly)**
   - EventBridge triggers Lambda function
   - Checks all bookings in next 48 hours
   - Calculates flight path waypoints (every 30 min)
   - Queries OpenWeatherMap API
   - Compares against weather minimums by training level

2. **Conflict Detection**
   - Identifies unsafe weather conditions
   - Updates booking status to WEATHER_HOLD
   - Publishes message to SQS reschedule queue

3. **AI Rescheduling**
   - Lambda consumes SQS messages
   - Calls GPT-4 via Vercel AI SDK
   - Generates 3 reschedule options
   - Considers instructor availability & weather forecasts
   - Stores suggestions in database

4. **Notification Delivery**
   - Publishes to SNS topic
   - Sends email via SES
   - Pushes real-time notification via SSE
   - Updates in-app notification center

---

## Database Schema

### Core Models

**Users**
- Authentication & profile data
- Role-based access (STUDENT, INSTRUCTOR, ADMIN)
- Training level (affects weather minimums)
- Availability patterns (instructors)

**Bookings**
- Scheduled flights with departure/arrival locations
- Duration, flight type, status tracking
- Links to students and instructors
- Weather check history

**Weather Checks**
- Timestamp and booking reference
- Waypoint-by-waypoint weather data
- Overall status (SAFE, MARGINAL, UNSAFE)
- Violation reasons

**Reschedule Logs**
- AI-generated suggestions (3 per conflict)
- Proposed dates, reasoning, confidence scores
- User selection tracking
- Processing metadata

**Notifications**
- Multi-channel delivery (email, SMS, in-app)
- Type categorization (alerts, reminders, confirmations)
- Read/unread status
- Delivery tracking

---

## Weather Logic

### Weather Minimums by Training Level

| Training Level | Visibility | Ceiling | Wind Speed | Wind Gust | Prohibited Conditions |
|---|---|---|---|---|---|
| Student Pilot | 5 mi | 3000 ft | 10 kt | 15 kt | Thunderstorm, Freezing, Ice, Snow, Fog |
| Private Pilot | 3 mi | 1000 ft | 15 kt | 20 kt | Thunderstorm, Freezing, Ice |
| Instrument Rated | 0.5 mi | 200 ft | 20 kt | 30 kt | Thunderstorm, Severe Icing, Tornado |

### Flight Path Calculation

- Calculate great circle distance between airports
- Generate waypoints every 30 minutes of flight time
- For local flights: create circular pattern waypoints
- Check weather at each waypoint against minimums
- Flag any violations along entire route

---

## API Architecture

### tRPC Routers

- **auth.router** - Authentication, user profile
- **bookings.router** - CRUD operations for bookings
- **weather.router** - Manual checks, forecasts
- **reschedule.router** - AI suggestions, confirmations
- **notifications.router** - Notification management
- **instructors.router** - Availability, schedules
- **admin.router** - Analytics, audit logs

### Key Endpoints

- `GET /api/notifications/stream` - SSE connection for real-time updates
- `POST /api/webhooks/weather-alert` - Receives EventBridge triggers
- `POST /api/trpc/bookings.create` - Create new booking
- `GET /api/trpc/reschedule.getSuggestions` - Fetch AI suggestions
- `POST /api/trpc/reschedule.confirm` - Confirm reschedule option

---

## AWS Lambda Functions

### Lambda 1: Weather Monitor
- **Trigger:** EventBridge (hourly: `cron(0 * * * ? *)`)
- **Runtime:** Node.js 20.x
- **Memory:** 512 MB
- **Timeout:** 5 minutes
- **Function:** Check weather for upcoming bookings, detect conflicts, queue for rescheduling

### Lambda 2: AI Rescheduler
- **Trigger:** SQS Queue
- **Runtime:** Node.js 20.x
- **Memory:** 1024 MB
- **Timeout:** 2 minutes
- **Function:** Generate reschedule options via GPT-4, validate against availability, notify users

---

## Project Structure

### Monorepo Workspace Layout

```
flight-lesson-rescheduler/
├── package.json                           # Root workspace config
├── packages/
│   ├── app/                               # Next.js 16 frontend + tRPC API
│   │   ├── src/
│   │   │   ├── app/                       # Next.js App Router
│   │   │   │   ├── (auth)/
│   │   │   │   │   ├── login/page.tsx
│   │   │   │   │   └── signup/page.tsx
│   │   │   │   ├── (dashboard)/
│   │   │   │   │   ├── layout.tsx
│   │   │   │   │   ├── student/
│   │   │   │   │   │   ├── page.tsx
│   │   │   │   │   │   ├── bookings/
│   │   │   │   │   │   └── reschedules/
│   │   │   │   │   ├── instructor/
│   │   │   │   │   │   ├── page.tsx
│   │   │   │   │   │   ├── schedule/
│   │   │   │   │   │   └── availability/
│   │   │   │   │   └── admin/
│   │   │   │   │       ├── page.tsx
│   │   │   │   │       ├── analytics/
│   │   │   │   │       └── users/
│   │   │   │   └── api/
│   │   │   │       ├── trpc/[trpc]/route.ts
│   │   │   │       └── notifications/stream/route.ts
│   │   │   ├── components/                # Shared UI components
│   │   │   ├── lib/                       # Utilities & helpers
│   │   │   └── server/                    # tRPC routers & context
│   │   ├── prisma/                        # Database schema
│   │   ├── public/                        # Static assets
│   │   └── package.json
│   ├── weather-lib/                       # Shared weather logic
│   │   ├── src/
│   │   │   ├── index.ts                   # Public exports
│   │   │   ├── types.ts                   # Zod schemas
│   │   │   ├── minimums.ts                # Weather minimums by training level
│   │   │   ├── waypoints.ts               # Flight path calculations
│   │   │   └── evaluation.ts              # Weather condition evaluation
│   │   └── package.json
│   └── functions/                         # AWS Lambda functions
│       ├── weather-monitor/               # Lambda 1: Hourly weather checks
│       │   ├── src/index.ts
│       │   └── package.json
│       └── ai-rescheduler/                # Lambda 2: AI reschedule suggestions
│           ├── src/index.ts
│           └── package.json
├── .taskmaster/                           # Task Master AI project management
│   ├── tasks/tasks.json
│   └── docs/PRD.md
├── docker-compose.yml                     # Local dev services (Postgres, Redis, LocalStack)
└── README.md
```

---

## Frontend Architecture

### Next.js App Router Structure

Located in `packages/app/src/app/`:

### Key Components

- **Dashboard Layout** - Role-based navigation with view toggle
- **Notification Listener** - SSE connection for real-time updates
- **Weather Widget** - Live weather display with 60s polling
- **Reschedule Options** - AI suggestion review interface
- **Booking Calendar** - Schedule visualization
- **Real-time Alerts** - Toast notifications for critical events

---

## Infrastructure & Deployment

### AWS Services

**RDS PostgreSQL**
- Instance: db.t3.micro (dev), db.t3.medium (prod)
- Storage: 20 GB GP3
- Multi-AZ: Yes (production)
- Backup: 7-day retention

**Lambda Configuration**
- Environment variables: DATABASE_URL, API keys
- IAM roles for RDS, SQS, SNS access
- CloudWatch logging enabled

**SQS Queue**
- Visibility timeout: 120s
- Message retention: 14 days
- Dead letter queue configured

**EventBridge**
- Hourly schedule for weather checks
- Targets Weather Monitor Lambda

**SNS Topic**
- Email notifications via SES
- SMS notifications (optional)
- In-app push via Lambda subscribers

### Local Development

**Workspace Commands:**
```bash
# Install all dependencies
npm install

# Run Next.js dev server
npm run dev

# Type check all packages
npm run typecheck

# Test all packages
npm run test
```

**Docker Compose Services:**
- PostgreSQL 16
- Redis 7 (caching)
- LocalStack (AWS emulation)
- Next.js dev server (packages/app)

### CI/CD Pipeline

GitHub Actions workflows:
- Run tests on pull requests
- Build and deploy Lambda functions
- Deploy Next.js to AWS Amplify
- Run E2E tests in staging

---

## Security & Compliance

### Authentication Flow
1. User logs in via AWS Amplify Auth (Cognito)
2. JWT access token returned
3. Next.js middleware validates token
4. User context injected into tRPC

### Authorization
- Role-based access control (RBAC)
- tRPC middleware for endpoint protection
- Resource-level permissions

### Data Protection
- Database encryption at rest
- SSL/TLS for all connections
- API key storage in AWS Secrets Manager
- Quarterly key rotation policy

---

## Testing Strategy

### Unit Tests (Vitest)
- Weather logic functions
- AI response parsing
- Waypoint calculations
- Weather minimums validation

### Integration Tests (Playwright)
- tRPC procedures
- Database operations
- Lambda functions (local)
- SQS/SNS integrations

### E2E Tests (Playwright)
- Complete booking flow
- Reschedule flow
- Notification delivery
- Role-based access

**Coverage Target:** 80%+

---

## Monitoring & Observability

### CloudWatch Dashboards
- Lambda invocations and errors
- SQS queue depth and age
- API response times (p95, p99)
- Database connection pool usage
- External API quota usage

### Alarms
- Weather Monitor failures (>3 in 5 min)
- SQS backlog (>50 messages)
- Database connections (>80% capacity)
- API latency (p95 >2s)

### Logging
- Structured logging with Pino
- Log aggregation to CloudWatch
- Error tracking with Sentry (optional)

---

## Project Phases

### Phase 1: Foundation (Weeks 1-2)
- Project initialization with Next.js 16
- Database schema design and Prisma setup
- AWS Amplify authentication
- tRPC API foundation

### Phase 2: Core Booking System (Weeks 3-4)
- Booking CRUD operations
- Instructor availability management
- Role-based dashboards
- Calendar components

### Phase 3: Weather Integration (Week 5)
- OpenWeatherMap API integration
- Weather Monitor Lambda
- EventBridge scheduler
- Waypoint calculation logic

### Phase 4: AI Rescheduling (Week 6)
- AI Rescheduler Lambda
- GPT-4 prompt engineering
- Reschedule UI
- SQS queue processing

### Phase 5: Notifications (Week 7)
- SNS/SES integration
- Server-Sent Events endpoint
- Notification center UI
- Multi-channel delivery

### Phase 6: Real-time Features (Week 8)
- Live dashboard updates
- Weather widget with polling
- Optimistic UI updates
- SSE reconnection logic

### Phase 7: Testing & Quality (Week 9)
- Unit tests for critical paths
- Integration tests for APIs
- E2E tests for user flows
- Performance optimization

### Phase 8: Deployment (Week 10)
- AWS infrastructure provisioning
- CI/CD pipeline setup
- Monitoring dashboards
- Production deployment

### Phase 9: Analytics & Reporting (Week 11)
- Admin dashboard
- Metrics and charts
- Audit logging
- Data export functionality

### Phase 10: Polish & Documentation (Week 12)
- UI/UX refinements
- Comprehensive documentation
- Demo video recording
- User guide creation

---

## Success Metrics

### Technical KPIs
- Weather check accuracy: >95%
- AI suggestion acceptance rate: >80%
- System uptime: >99.5%
- API response time (p95): <2s
- Lambda cold start: <3s
- Notification delivery: >99% within 30s

### Business KPIs
- Bookings created per month
- Weather conflicts detected (%)
- Successful reschedules via AI (%)
- Average rescheduling time
- User satisfaction score

---

## Risk Mitigation

### Technical Risks
1. **OpenWeatherMap rate limits** - Cache data, implement fallback API
2. **GPT-4 API failures** - Retry logic, DLQ, rule-based fallback
3. **Database connection exhaustion** - Connection pooling, read replicas
4. **Lambda cold starts** - Provisioned concurrency for critical functions
5. **SSE connection drops** - Auto-reconnection, graceful polling fallback

### Operational Risks
1. **Incorrect weather logic** - Aviation SME review, gradual rollout
2. **AI hallucinations** - Structured output parsing, confidence thresholds
3. **Notification failures** - Multi-channel delivery, retry queues

---

## Future Enhancements (V2)

1. Google Calendar integration
2. SMS notifications via Twilio
3. React Native mobile app
4. ML-based cancellation prediction
5. Multi-airport route weather
6. Aircraft resource management
7. Instructor preference learning
8. Weather radar visualization
9. One-click auto-rebooking
10. Student progress tracking

---

## Key Dependencies

### Package Distribution by Workspace

**Root (`package.json`)**
```json
{
  "workspaces": ["packages/app", "packages/weather-lib", "packages/functions/*"],
  "devDependencies": {
    "typescript": "^5.6.0",
    "prettier": "^3.0.0",
    "eslint": "^9.0.0"
  }
}
```

**Next.js App (`packages/app/package.json`)**
```json
{
  "dependencies": {
    "next": "^16.0.1",
    "react": "^19.2.0",
    "react-dom": "^19.2.0",
    "@trpc/server": "^11.0.0",
    "@trpc/client": "^11.0.0",
    "@trpc/react-query": "^11.0.0",
    "@trpc/next": "^11.0.0",
    "@tanstack/react-query": "^5.84.0",
    "@prisma/client": "^5.0.0",
    "aws-amplify": "^6.10.0",
    "tailwindcss": "^4.0.0",
    "zod": "^3.24.0",
    "date-fns": "^3.0.0",
    "sonner": "^1.7.0",
    "@flight-rescheduler/weather-lib": "*"
  },
  "devDependencies": {
    "prisma": "^5.0.0"
  }
}
```

**Weather Library (`packages/weather-lib/package.json`)**
```json
{
  "name": "@flight-rescheduler/weather-lib",
  "dependencies": {
    "zod": "^3.24.0",
    "date-fns": "^3.0.0"
  }
}
```

**Lambda Functions (`packages/functions/*/package.json`)**
```json
{
  "dependencies": {
    "@flight-rescheduler/weather-lib": "*",
    "@prisma/client": "^5.0.0",
    "@aws-sdk/client-sqs": "^3.700.0",
    "@aws-sdk/client-sns": "^3.700.0",
    "ai": "^4.0.0",
    "@ai-sdk/openai": "^1.0.0",
    "openai": "^4.0.0",
    "zod": "^3.24.0"
  },
  "devDependencies": {
    "esbuild": "^0.24.0"
  }
}
```

---

## Environment Variables

```bash
# Database
DATABASE_URL="postgresql://user:password@host:5432/db"

# AWS
AWS_REGION="us-east-1"
AWS_ACCESS_KEY_ID=""
AWS_SECRET_ACCESS_KEY=""
RESCHEDULE_QUEUE_URL=""
NOTIFICATION_TOPIC_ARN=""

# OpenAI
OPENAI_API_KEY=""

# OpenWeatherMap
OPENWEATHER_API_KEY=""

# Amplify Auth
NEXT_PUBLIC_AMPLIFY_USER_POOL_ID=""
NEXT_PUBLIC_AMPLIFY_WEB_CLIENT_ID=""
NEXT_PUBLIC_AMPLIFY_REGION=""

# Application
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NODE_ENV="development"
LOG_LEVEL="info"
```

---

## Glossary

- **RBAC** - Role-Based Access Control
- **SSE** - Server-Sent Events (one-way server push)
- **SQS** - Simple Queue Service (AWS message queue)
- **SNS** - Simple Notification Service (AWS pub/sub)
- **IMC** - Instrument Meteorological Conditions
- **VFR** - Visual Flight Rules (clear weather)
- **IFR** - Instrument Flight Rules (low visibility)
- **AGL** - Above Ground Level (altitude)
- **ICAO** - International Civil Aviation Organization

---

**Document Status:** Ready for Development  
**Estimated Timeline:** 12 weeks  
**Team Size:** 2-3 developers + 1 designer
