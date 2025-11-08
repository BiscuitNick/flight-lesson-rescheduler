/**
 * Authentication actions
 * Client-side auth operations using AWS Amplify
 */

import {
  signIn as amplifySignIn,
  signOut as amplifySignOut,
  signUp as amplifySignUp,
  confirmSignUp as amplifyConfirmSignUp,
  resetPassword as amplifyResetPassword,
  confirmResetPassword as amplifyConfirmResetPassword,
  resendSignUpCode as amplifyResendSignUpCode,
} from 'aws-amplify/auth';
import type { UserRole, TrainingLevel } from '@prisma/client';

/**
 * Sign up a new user
 */
export async function signUp(params: {
  email: string;
  password: string;
  name: string;
  role?: UserRole;
  trainingLevel?: TrainingLevel;
}) {
  const { email, password, name, role = 'STUDENT', trainingLevel } = params;

  const userAttributes: Record<string, string> = {
    email,
    name,
    'custom:role': role,
  };

  if (trainingLevel) {
    userAttributes['custom:trainingLevel'] = trainingLevel;
  }

  return amplifySignUp({
    username: email,
    password,
    options: {
      userAttributes,
    },
  });
}

/**
 * Confirm sign up with verification code
 */
export async function confirmSignUp(email: string, code: string) {
  return amplifyConfirmSignUp({
    username: email,
    confirmationCode: code,
  });
}

/**
 * Resend sign up confirmation code
 */
export async function resendSignUpCode(email: string) {
  return amplifyResendSignUpCode({
    username: email,
  });
}

/**
 * Sign in a user
 */
export async function signIn(email: string, password: string) {
  return amplifySignIn({
    username: email,
    password,
  });
}

/**
 * Sign out the current user
 */
export async function signOut() {
  return amplifySignOut();
}

/**
 * Initiate password reset
 */
export async function resetPassword(email: string) {
  return amplifyResetPassword({
    username: email,
  });
}

/**
 * Confirm password reset with code
 */
export async function confirmResetPassword(
  email: string,
  code: string,
  newPassword: string,
) {
  return amplifyConfirmResetPassword({
    username: email,
    confirmationCode: code,
    newPassword,
  });
}
