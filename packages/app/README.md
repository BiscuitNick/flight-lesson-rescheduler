# Flight Lesson Rescheduler - Next.js App

Weather-aware flight lesson scheduling with AI-powered rescheduling.

## Tech Stack

This application is built with:

- **Next.js 16.0.1** (App Router)
- **React 19.2.0** / **React DOM 19.2.0** (Supported Runtime)
- **TypeScript 5.6.x**
- **Tailwind CSS 4.0**
- **shadcn/ui** component library
- **tRPC 11** for type-safe APIs
- **TanStack Query 5.84.x** for data fetching/caching
- **Prisma 5.x** ORM
- **AWS Amplify** for authentication
- **Vitest** for unit testing
- **Playwright** for e2e testing

## React 19.2.0 Runtime

This project uses **React 19.2.0** and **React DOM 19.2.0** as the supported runtime versions. This is a stable release with the following considerations:

- All providers and components are compatible with React 19's behavior
- Server Components and Client Components work as expected
- Testing frameworks (Vitest, Playwright) are configured for React 19
- Future upgrades should verify compatibility with the React 19 API surface

## Getting Started

### Prerequisites

- Node.js 20.x or later
- npm, yarn, pnpm, or bun
- Docker and Docker Compose (for local services)

### Installation

```bash
# Install dependencies
npm install

# Copy environment variables
cp ../../.env.example ../../.env

# Edit .env with your actual values
```

### Development

```bash
# Run the Next.js development server
npm run dev

# Open http://localhost:3000
```

### Using Docker Compose

```bash
# Start all services (Postgres, Redis, LocalStack, App)
docker compose up

# Start services in background
docker compose up -d

# Stop services
docker compose down

# View service logs
docker compose logs -f app
```

## Available Scripts

### Development

- `npm run dev` - Start Next.js development server on port 3000
- `npm run build` - Build production application
- `npm run start` - Start production server
- `npm run lint` - Run ESLint for code quality
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check code formatting

### Type Checking

```bash
npm run typecheck
```

Validates TypeScript types across the entire application. This confirms the React 19.2.0 / TypeScript 5.6.x baseline compiles correctly.

### Testing

#### Unit Tests (Vitest)

```bash
# Run all unit tests
npm run test:unit

# Run tests in watch mode
npm run test:unit:watch

# Run tests with coverage
npm run test
```

#### End-to-End Tests (Playwright)

```bash
# List all e2e tests
npm run test:e2e -- --list

# Run e2e tests
npm run test:e2e

# Run e2e tests with UI
npm run test:e2e:ui
```

## Project Structure

```
packages/app/
├── app/                    # Next.js App Router
│   ├── (auth)/             # Authentication routes
│   │   ├── login/
│   │   └── signup/
│   ├── (dashboard)/        # Protected dashboard routes
│   │   ├── student/
│   │   ├── instructor/
│   │   └── admin/
│   ├── api/                # API routes
│   │   ├── trpc/[trpc]/    # tRPC endpoint
│   │   └── notifications/stream/  # SSE endpoint
│   ├── layout.tsx          # Root layout with providers
│   ├── page.tsx            # Home page
│   └── globals.css         # Global styles
├── lib/                    # Shared utilities
│   ├── providers/          # React context providers
│   │   ├── auth-provider.tsx
│   │   ├── query-provider.tsx
│   │   └── toast-provider.tsx
│   └── hooks/              # Custom React hooks
│       └── use-sse.ts      # SSE notifications hook
├── tests/                  # Test files
│   ├── unit/               # Vitest unit tests
│   └── e2e/                # Playwright e2e tests
├── public/                 # Static assets
└── package.json            # Dependencies and scripts
```

## Global Providers

The root layout (`app/layout.tsx`) wraps the application with these providers:

1. **AuthProvider** - AWS Amplify authentication (configured in Task 4)
2. **QueryProvider** - TanStack Query for data fetching and caching
3. **ToastProvider** - Sonner toast notifications

These providers are React 19.2.0 compatible and work seamlessly with Server Components.

## SSE Notifications

Real-time notifications are handled via Server-Sent Events (SSE):

```tsx
import { useSSE } from '@/lib/hooks/use-sse';

function MyComponent() {
  const { isConnected, lastMessage } = useSSE(true);

  // Use isConnected and lastMessage in your component
}
```

## Verification Checklist

Before committing, ensure:

1. ✅ **Linting passes**: `npm run lint`
2. ✅ **Type checking passes**: `npm run typecheck`
3. ✅ **Unit tests pass**: `npm run test:unit`
4. ✅ **E2E tests listed**: `npm run test:e2e -- --list`
5. ✅ **Docker services start**: `docker compose up` (validates docker-compose.yml)
6. ✅ **Dev server boots**: `npm run dev` (no runtime errors with React 19.2.0)

## Environment Variables

See `../../.env.example` for all required environment variables:

- Database configuration (PostgreSQL)
- Redis configuration
- AWS/LocalStack configuration
- AWS Amplify Auth credentials
- OpenAI API key for AI rescheduling
- Weather API credentials

## Troubleshooting

### React 19 Compatibility Issues

If you encounter dependency conflicts:

1. Check that all dependencies support React 19
2. Review npm install output for peer dependency warnings
3. Consult library documentation for React 19 migration guides

### Docker Issues

If services fail to start:

```bash
# Check service status
docker compose ps

# View service logs
docker compose logs postgres
docker compose logs redis
docker compose logs localstack

# Rebuild containers
docker compose build --no-cache
```

## Learn More

- [Next.js 16 Documentation](https://nextjs.org/docs)
- [React 19 Documentation](https://react.dev)
- [tRPC Documentation](https://trpc.io)
- [TanStack Query Documentation](https://tanstack.com/query)
- [Prisma Documentation](https://prisma.io/docs)
- [Tailwind CSS 4 Documentation](https://tailwindcss.com/docs)
