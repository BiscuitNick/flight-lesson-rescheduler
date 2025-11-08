/**
 * Amplify server-side configuration
 * Custom implementation for Next.js 16 compatibility
 */

import { Amplify } from 'aws-amplify';
import { amplifyConfig } from './config';

/**
 * Initialize Amplify for server-side use
 * Note: Since @aws-amplify/adapter-nextjs doesn't support Next.js 16 yet,
 * we use a simplified server-side approach
 */
let isConfigured = false;

export function configureAmplifyServer() {
  if (!isConfigured && typeof window === 'undefined') {
    Amplify.configure(amplifyConfig, { ssr: false });
    isConfigured = true;
  }
}

/**
 * Wrapper for Amplify server operations
 * Ensures Amplify is configured before running operations
 */
export async function runWithAmplifyServerContext<T>(params: {
  nextServerContext?: { request?: Request };
  operation: (contextSpec?: unknown) => Promise<T>;
}): Promise<T> {
  configureAmplifyServer();
  return params.operation();
}
