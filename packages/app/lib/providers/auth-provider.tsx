'use client';

import { Amplify } from 'aws-amplify';
import { useEffect } from 'react';

// Amplify configuration will be set up in Task 4
// This is a placeholder provider for now
const amplifyConfig = {
  Auth: {
    Cognito: {
      userPoolId: process.env.NEXT_PUBLIC_AMPLIFY_USER_POOL_ID || '',
      userPoolClientId: process.env.NEXT_PUBLIC_AMPLIFY_USER_POOL_CLIENT_ID || '',
      region: process.env.NEXT_PUBLIC_AMPLIFY_REGION || 'us-east-1',
    },
  },
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Configure Amplify on client mount
    if (
      process.env.NEXT_PUBLIC_AMPLIFY_USER_POOL_ID &&
      process.env.NEXT_PUBLIC_AMPLIFY_USER_POOL_CLIENT_ID
    ) {
      Amplify.configure(amplifyConfig, { ssr: true });
    }
  }, []);

  return <>{children}</>;
}
