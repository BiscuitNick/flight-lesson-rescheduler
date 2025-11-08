'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/providers/auth-provider';
import {
  getDevAccounts,
  setDevUser,
  DEV_TEST_ACCOUNTS,
} from '@/lib/auth/dev-auth';
import { Users, ChevronDown, Check } from 'lucide-react';

/**
 * Dev Account Switcher
 * Floating button that allows switching between test accounts in dev mode
 */
export function DevAccountSwitcher() {
  const { isDevMode, user, refreshUser } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  if (!isDevMode) {
    return null;
  }

  const accounts = getDevAccounts();

  const handleAccountSwitch = async (
    accountKey: keyof typeof DEV_TEST_ACCOUNTS,
  ) => {
    setDevUser(accountKey);
    await refreshUser();
    setIsOpen(false);
  };

  return (
    <div className="fixed right-4 top-4 z-50">
      {isOpen && (
        <div className="mt-2 w-64 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
          <div className="border-b border-gray-200 bg-gray-50 px-4 py-2">
            <h3 className="text-sm font-semibold text-gray-700">
              Dev Accounts
            </h3>
            <p className="text-xs text-gray-500">Switch test account</p>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {accounts.map((account) => (
              <button
                key={account.key}
                onClick={() =>
                  handleAccountSwitch(account.key as keyof typeof DEV_TEST_ACCOUNTS)
                }
                className="flex w-full items-center justify-between border-b border-gray-100 px-4 py-3 text-left transition-colors hover:bg-gray-50"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900">
                      {account.name}
                    </span>
                    {user?.email === account.email && (
                      <Check className="h-4 w-4 text-green-600" />
                    )}
                  </div>
                  <div className="text-xs text-gray-500">{account.email}</div>
                  <div className="mt-1 flex gap-2">
                    <span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                      {account.role}
                    </span>
                    {account.trainingLevel && (
                      <span className="rounded bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">
                        {account.trainingLevel.replace(/_/g, ' ')}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-full bg-orange-500 px-4 py-3 text-sm font-semibold text-white shadow-lg transition-all hover:bg-orange-600 hover:shadow-xl"
      >
        <Users className="h-5 w-5" />
        <span className="hidden sm:inline">Dev: {user?.name}</span>
        <ChevronDown
          className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>
    </div>
  );
}
