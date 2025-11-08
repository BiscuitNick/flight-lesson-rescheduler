/**
 * Student Reschedules Page
 * View and manage AI-generated reschedule suggestions
 */

'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc/client';
import { SuggestionsList } from '@/components/reschedule';
import { formatDateTime, formatFlightRoute } from '@/lib/utils';
import { toast } from 'sonner';
import { Suspense } from 'react';

function ReschedulesPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const bookingId = searchParams.get('bookingId');

  // If no booking ID, show all pending suggestions
  const { data: pendingSuggestions, isLoading: loadingPending } =
    trpc.reschedule.getPending.useQuery(undefined, {
      enabled: !bookingId,
    });

  // If booking ID provided, fetch that specific booking
  const { data: booking, isLoading: loadingBooking } = trpc.bookings.getById.useQuery(
    { id: bookingId! },
    { enabled: !!bookingId },
  );

  const utils = trpc.useUtils();

  // Request manual reschedule mutation
  const requestManualMutation = trpc.reschedule.requestManual.useMutation({
    onSuccess: () => {
      toast.success('Manual reschedule request submitted');
      utils.bookings.getById.invalidate();
      utils.reschedule.getSuggestions.invalidate();
    },
    onError: (error) => {
      toast.error(`Failed to request manual reschedule: ${error.message}`);
    },
  });

  const handleRequestManual = async (bookingId: string) => {
    const reason = prompt('Please provide a reason for manual rescheduling (optional):');
    await requestManualMutation.mutateAsync({
      bookingId,
      reason: reason || undefined,
    });
  };

  // Single booking view
  if (bookingId) {
    if (loadingBooking) {
      return (
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-lg">Loading...</div>
        </div>
      );
    }

    if (!booking) {
      return (
        <div className="p-6">
          <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
            <h2 className="text-lg font-semibold text-red-900">Booking Not Found</h2>
            <p className="mt-2 text-sm text-red-700">
              The booking you're looking for doesn't exist or you don't have permission to view it.
            </p>
            <button
              onClick={() => router.push('/student')}
              className="mt-4 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-6 p-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold">Reschedule Suggestions</h1>
            <p className="text-gray-600">Review AI-generated alternatives for your lesson</p>
          </div>
          <button
            onClick={() => router.push('/student')}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Back to Dashboard
          </button>
        </div>

        {/* Booking Details Card */}
        <div className="rounded-lg border bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold">Original Booking</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <div className="text-sm font-medium text-gray-700">Flight Route</div>
              <div className="mt-1 text-base">
                {formatFlightRoute(booking.departureLocation, booking.arrivalLocation)}
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-700">Instructor</div>
              <div className="mt-1 text-base">{booking.instructor.name}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-700">Scheduled Time</div>
              <div className="mt-1 text-base">{formatDateTime(booking.scheduledStart)}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-700">Status</div>
              <div className="mt-1">
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    booking.status === 'WEATHER_HOLD'
                      ? 'bg-yellow-100 text-yellow-800'
                      : booking.status === 'AWAITING_RESPONSE'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {booking.status.replace('_', ' ')}
                </span>
              </div>
            </div>
          </div>

          {/* Request Manual Reschedule */}
          <div className="mt-4 border-t pt-4">
            <p className="text-sm text-gray-600">
              Not satisfied with AI suggestions? Request manual rescheduling assistance.
            </p>
            <button
              onClick={() => handleRequestManual(booking.id)}
              disabled={requestManualMutation.isPending}
              className="mt-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:bg-gray-100"
            >
              {requestManualMutation.isPending
                ? 'Requesting...'
                : 'Request Manual Reschedule'}
            </button>
          </div>
        </div>

        {/* Suggestions List */}
        <div className="rounded-lg border bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold">AI Suggestions</h2>
          <SuggestionsList bookingId={bookingId} />
        </div>
      </div>
    );
  }

  // All pending suggestions view
  if (loadingPending) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold">All Reschedule Suggestions</h1>
          <p className="text-gray-600">Review pending reschedule suggestions for your bookings</p>
        </div>
        <button
          onClick={() => router.push('/student')}
          className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Back to Dashboard
        </button>
      </div>

      {/* Pending Suggestions */}
      {!pendingSuggestions || pendingSuggestions.length === 0 ? (
        <div className="rounded-lg border bg-white p-12 text-center">
          <svg
            className="mx-auto h-16 w-16 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <h3 className="mt-4 text-lg font-medium text-gray-900">No Pending Suggestions</h3>
          <p className="mt-2 text-sm text-gray-500">
            You don't have any pending reschedule suggestions at the moment.
          </p>
          <button
            onClick={() => router.push('/student')}
            className="mt-6 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            View Dashboard
          </button>
        </div>
      ) : (
        <div className="grid gap-6">
          {pendingSuggestions.map((suggestion) => (
            <div key={suggestion.id} className="rounded-lg border bg-white p-6">
              <div className="mb-4 flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold">
                    {formatFlightRoute(
                      suggestion.booking.departureLocation,
                      suggestion.booking.arrivalLocation,
                    )}
                  </h3>
                  <p className="text-sm text-gray-600">
                    with {suggestion.booking.instructor.name}
                  </p>
                </div>
                <button
                  onClick={() => router.push(`/student/reschedules?bookingId=${suggestion.bookingId}`)}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  View Suggestions
                </button>
              </div>
              <div className="text-sm text-gray-700">
                <span className="font-medium">Original Time:</span>{' '}
                {formatDateTime(suggestion.booking.scheduledStart)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ReschedulesPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Loading...</div>}>
      <ReschedulesPageContent />
    </Suspense>
  );
}
