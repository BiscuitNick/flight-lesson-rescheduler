'use client';

import { useAuth } from '@/lib/providers/auth-provider';
import { trpc } from '@/lib/trpc/client';
import { signOut } from '@/lib/auth/actions';
import { useRouter } from 'next/navigation';

export default function AdminDashboard() {
  const { user, isLoading: authLoading } = useAuth();
  const { data: userProfile, isLoading: profileLoading } =
    trpc.user.me.useQuery(undefined, {
      enabled: !!user,
    });
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
  };

  if (authLoading || profileLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          <p className="text-gray-600">
            Manage school settings and system configuration
          </p>
        </div>
        <button
          onClick={handleSignOut}
          className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
        >
          Sign Out
        </button>
      </div>

      {/* User Profile Card */}
      <div className="rounded-lg border bg-white p-4">
        <h2 className="mb-3 text-lg font-semibold">Profile</h2>
        <div className="space-y-2 text-sm">
          <div>
            <span className="font-medium">Name:</span> {userProfile?.name}
          </div>
          <div>
            <span className="font-medium">Email:</span> {userProfile?.email}
          </div>
          <div>
            <span className="font-medium">Role:</span> {userProfile?.role}
          </div>
        </div>
      </div>

      {/* Dashboard content placeholders */}
      <div className="grid gap-4">
        <div className="rounded-lg border bg-white p-4">
          <h2 className="mb-2 text-lg font-semibold">System Status</h2>
          <p className="text-sm text-gray-600">
            Monitoring dashboard to be implemented with tRPC (Task 10)
          </p>
        </div>

        <div className="rounded-lg border bg-white p-4">
          <h2 className="mb-2 text-lg font-semibold">User Management</h2>
          <p className="text-sm text-gray-600">
            User admin panel to be implemented with tRPC (Task 4)
          </p>
        </div>

        <div className="rounded-lg border bg-white p-4">
          <h2 className="mb-2 text-lg font-semibold">
            Weather Minimums Config
          </h2>
          <p className="text-sm text-gray-600">
            Configuration UI to be implemented with tRPC (Task 5)
          </p>
        </div>

        <div className="rounded-lg border bg-white p-4">
          <h2 className="mb-2 text-lg font-semibold">Notification Settings</h2>
          <p className="text-sm text-gray-600">
            Notification config to be implemented with tRPC (Task 9)
          </p>
        </div>
      </div>
    </div>
  );
}
