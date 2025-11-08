# Authentication & RBAC System

This directory contains the authentication and role-based access control (RBAC) implementation for the Flight Lesson Rescheduler application.

## Overview

The auth system is built on AWS Amplify Auth (Cognito) and provides:

- User authentication (sign up, sign in, sign out)
- Role-based access control (Student, Instructor, Admin)
- Training level tracking for students
- JWT token validation in Next.js middleware
- tRPC context integration with authenticated user information

## Architecture

### Client-Side Components

1. **AuthProvider** (`lib/providers/auth-provider.tsx`)
   - Configures AWS Amplify on the client
   - Manages authentication state
   - Provides `useAuth()` hook for accessing current user

2. **Auth Actions** (`lib/auth/actions.ts`)
   - Sign up with email/password
   - Sign in
   - Sign out
   - Password reset
   - Email confirmation

3. **Auth Configuration** (`lib/auth/config.ts`)
   - Amplify configuration for Cognito
   - Environment variable checks

### Server-Side Components

1. **Middleware** (`middleware.ts`)
   - Validates JWT tokens from cookies
   - Protects routes based on authentication
   - Enforces role-based access
   - Injects user claims into request headers

2. **tRPC Context** (`lib/server/trpc/context.ts`)
   - Extracts user from middleware headers
   - Provides authentication helpers:
     - `assertAuthenticated()` - Ensures user is logged in
     - `assertRole([roles])` - Ensures user has required role
     - `assertAdmin()` - Ensures user is admin
     - `assertInstructor()` - Ensures user is instructor or admin
     - `assertOwnership()` - Ensures user owns the resource

3. **tRPC Procedures** (`lib/server/trpc/init.ts`)
   - `publicProcedure` - No authentication required
   - `protectedProcedure` - Requires authentication

## User Roles

### STUDENT
- Can view their own lessons
- Can accept/decline reschedule suggestions
- Limited to viewing their own data

### INSTRUCTOR
- Can view assigned students
- Can manage their availability
- Can view lessons they're instructing
- Can override reschedule suggestions

### ADMIN
- Full system access
- User management
- Weather minimums configuration
- System settings

## Environment Variables

Required environment variables (set in `.env.local`):

```bash
# AWS Cognito Configuration
NEXT_PUBLIC_AMPLIFY_USER_POOL_ID=your_user_pool_id
NEXT_PUBLIC_AMPLIFY_USER_POOL_CLIENT_ID=your_client_id
NEXT_PUBLIC_AMPLIFY_REGION=us-east-1
```

## Usage Examples

### Client-Side Authentication

```tsx
'use client';

import { useAuth } from '@/lib/providers/auth-provider';
import { signIn, signOut } from '@/lib/auth/actions';

function MyComponent() {
  const { user, isLoading, refreshUser } = useAuth();

  async function handleSignIn(email: string, password: string) {
    await signIn(email, password);
    await refreshUser();
  }

  async function handleSignOut() {
    await signOut();
  }

  if (isLoading) return <div>Loading...</div>;
  if (!user) return <div>Not authenticated</div>;

  return <div>Welcome, {user.name}!</div>;
}
```

### Server-Side with tRPC

```ts
import { createTRPCRouter, protectedProcedure } from '@/lib/server/trpc/init';
import { assertRole } from '@/lib/server/trpc/context';
import { z } from 'zod';

export const myRouter = createTRPCRouter({
  // Requires authentication
  getMyData: protectedProcedure.query(({ ctx }) => {
    return { userId: ctx.user.id, role: ctx.user.role };
  }),

  // Admin-only endpoint
  deleteUser: protectedProcedure
    .input(z.object({ userId: z.string() }))
    .mutation(({ ctx, input }) => {
      assertRole(ctx.user, ['ADMIN']);
      // Delete user logic
    }),

  // Instructor or Admin
  viewAllLessons: protectedProcedure.query(({ ctx }) => {
    assertRole(ctx.user, ['INSTRUCTOR', 'ADMIN']);
    // Return all lessons
  }),
});
```

### Route Protection

Protected routes are automatically guarded by middleware:

- `/dashboard/*` - Requires authentication
- `/dashboard/admin/*` - Requires ADMIN role
- `/dashboard/instructor/*` - Requires INSTRUCTOR or ADMIN role
- `/dashboard/student/*` - Requires any authenticated user

Unauthenticated users are redirected to `/login`.
Authenticated users accessing `/login` or `/signup` are redirected to their role-based dashboard.

## Custom Attributes in Cognito

The system uses custom Cognito attributes:

- `custom:role` - User role (STUDENT, INSTRUCTOR, ADMIN)
- `custom:trainingLevel` - Training level (STUDENT_PILOT, PRIVATE_PILOT, INSTRUMENT_RATED)

These must be configured in your Cognito User Pool.

## Security Notes

1. **JWT Validation**: The middleware currently parses JWT payloads without full signature verification for Next.js 16 compatibility. In production, always verify JWT signatures using Cognito's public keys.

2. **HTTPS Only**: Always use HTTPS in production to protect JWT tokens in transit.

3. **Token Storage**: Amplify stores tokens in HTTP-only cookies for security.

4. **Role Claims**: User roles are stored in Cognito custom attributes and included in JWT tokens.

## Testing

See `lib/auth/__tests__/` for authentication unit tests.

## Troubleshooting

### Auth not working
1. Check environment variables are set
2. Verify Cognito User Pool configuration
3. Check browser console for Amplify errors

### Middleware redirect loop
1. Check that auth routes don't require authentication
2. Verify JWT token is being set in cookies

### RBAC errors
1. Ensure user has correct role in Cognito
2. Check custom attributes are configured in User Pool
3. Verify middleware is injecting headers correctly
