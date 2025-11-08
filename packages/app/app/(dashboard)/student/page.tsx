'use client';

import { useAuth } from '@/lib/providers/auth-provider';
import { trpc } from '@/lib/trpc/client';
import { signOut } from '@/lib/auth/actions';
import { useRouter } from 'next/navigation';
import { UpcomingBookings } from '@/components/bookings';
import { PendingSuggestionsWidget } from '@/components/reschedule';

export default function StudentDashboard() {
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
          <h1 className="text-3xl font-bold">Student Dashboard</h1>
          <p className="text-gray-600">View and manage your flight lessons</p>
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
          {userProfile?.trainingLevel && (
            <div>
              <span className="font-medium">Training Level:</span>{' '}
              {userProfile.trainingLevel.replace('_', ' ')}
            </div>
          )}
        </div>
      </div>

      {/* Dashboard content */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <UpcomingBookings />
        </div>

        <div className="space-y-4">
          <PendingSuggestionsWidget />

          <div className="rounded-lg border bg-white p-4">
            <h2 className="mb-2 text-lg font-semibold">Weather Alerts</h2>
            <p className="text-sm text-gray-600">
              Weather notifications to be implemented with SSE (Task 9)
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
