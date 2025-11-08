/**
 * AWS Amplify Auth Configuration
 * Configures Cognito authentication for the Flight Lesson Rescheduler
 */

import { ResourcesConfig } from 'aws-amplify';

export const amplifyConfig: ResourcesConfig = {
  Auth: {
    Cognito: {
      userPoolId: process.env.NEXT_PUBLIC_AMPLIFY_USER_POOL_ID || '',
      userPoolClientId:
        process.env.NEXT_PUBLIC_AMPLIFY_USER_POOL_CLIENT_ID || '',
      identityPoolId: process.env.NEXT_PUBLIC_AMPLIFY_IDENTITY_POOL_ID,
      loginWith: {
        email: true,
      },
      signUpVerificationMethod: 'code',
      userAttributes: {
        email: {
          required: true,
        },
        name: {
          required: true,
        },
      },
      allowGuestAccess: false,
      passwordFormat: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireNumbers: true,
        requireSpecialCharacters: true,
      },
    },
  },
};

/**
 * Check if Amplify Auth is properly configured
 */
export function isAuthConfigured(): boolean {
  return !!(
    process.env.NEXT_PUBLIC_AMPLIFY_USER_POOL_ID &&
    process.env.NEXT_PUBLIC_AMPLIFY_USER_POOL_CLIENT_ID
  );
}
