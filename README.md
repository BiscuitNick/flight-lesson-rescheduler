# Flight Lesson Rescheduler

Weather-aware flight lesson scheduling with AI-powered rescheduling.

## 📁 Project Structure

```
flight-lesson-rescheduler/
├── packages/
│   ├── app/                      # Next.js 16 frontend + tRPC API
│   ├── weather-lib/              # Shared weather logic
│   └── functions/
│       ├── weather-monitor/      # Lambda: Hourly weather checks
│       └── ai-rescheduler/       # Lambda: AI-powered reschedule suggestions
├── .taskmaster/                  # Task Master AI project management
└── docker-compose.yml            # Local development services
```

## 🚀 Quick Start

### Install Dependencies
```bash
# Install all workspace dependencies
npm install

# Or install for specific packages
npm install --workspace=packages/app
npm install --workspace=packages/weather-lib
```

### Development
```bash
# Run Next.js dev server
npm run dev

# Run type checking across all packages
npm run typecheck

# Run tests
npm run test
```

## 📦 Packages

### `packages/app`
Next.js 16 frontend with tRPC API, TanStack Query, Prisma, and AWS Amplify Auth.

### `packages/weather-lib`
Shared library for weather calculations, waypoint generation, and weather minimum evaluations. Used by both the Next.js app and Lambda functions.

### `packages/functions/weather-monitor`
AWS Lambda function triggered hourly by EventBridge to check weather conditions for upcoming flights.

### `packages/functions/ai-rescheduler`
AWS Lambda function triggered by SQS to generate AI-powered reschedule suggestions using GPT-4.

## 🛠️ Tech Stack

- **Framework:** Next.js 16.0.1 (App Router)
- **Language:** TypeScript 5.6.x
- **Database:** PostgreSQL + Prisma 5.x
- **API:** tRPC 11
- **State:** TanStack Query 5.84
- **Styling:** Tailwind CSS 4.0 + shadcn/ui
- **AI:** Vercel AI SDK + OpenAI GPT-4
- **Cloud:** AWS (Lambda, SQS, SNS, RDS, Amplify)

## 📚 Documentation

See `.taskmaster/docs/PRD.md` for detailed technical requirements.
