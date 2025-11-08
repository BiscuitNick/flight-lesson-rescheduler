'use client';

import { Amplify } from 'aws-amplify';
import { useEffect, useState, createContext, useContext } from 'react';
import { amplifyConfig, isAuthConfigured } from '@/lib/auth/config';
import { getAuthenticatedUser, type AuthenticatedUser } from '@/lib/auth/session';

interface AuthContextValue {
  user: AuthenticatedUser | null;
  isLoading: boolean;
  isConfigured: boolean;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  isLoading: true,
  isConfigured: false,
  refreshUser: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConfigured] = useState(isAuthConfigured());

  const refreshUser = async () => {
    try {
      setIsLoading(true);
      const authenticatedUser = await getAuthenticatedUser();
      setUser(authenticatedUser);
    } catch (error) {
      // User is not authenticated
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Configure Amplify on client mount
    if (isConfigured) {
      Amplify.configure(amplifyConfig, { ssr: true });

      // Load initial user state
      refreshUser();
    } else {
      console.warn(
        'Amplify Auth is not configured. Please set NEXT_PUBLIC_AMPLIFY_USER_POOL_ID and NEXT_PUBLIC_AMPLIFY_USER_POOL_CLIENT_ID environment variables.'
      );
      setIsLoading(false);
    }
  }, [isConfigured]);

  const value: AuthContextValue = {
    user,
    isLoading,
    isConfigured,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
