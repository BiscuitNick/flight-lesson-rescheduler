/**
 * Pending Suggestions Widget Component
 * Dashboard widget showing pending reschedule suggestions for the current user
 */

'use client';

import { trpc } from '@/lib/trpc/client';
import { formatDateTime } from '@/lib/utils';
import { toast } from 'sonner';
import Link from 'next/link';

export function PendingSuggestionsWidget() {
  const utils = trpc.useUtils();

  // Fetch pending suggestions
  const { data: suggestions, isLoading } = trpc.reschedule.getPending.useQuery();

  // Quick confirm mutation
  const confirmMutation = trpc.reschedule.confirm.useMutation({
    onSuccess: () => {
      toast.success('Reschedule confirmed!');
      utils.reschedule.getPending.invalidate();
      utils.bookings.upcoming.invalidate();
    },
    onError: (error) => {
      toast.error(`Failed to confirm: ${error.message}`);
    },
  });

  const handleQuickConfirm = async (suggestionId: string, bookingId: string) => {
    if (
      confirm(
        'Are you sure you want to confirm this reschedule? This will update your booking immediately.',
      )
    ) {
      await confirmMutation.mutateAsync({ suggestionId });
    }
  };

  if (isLoading) {
    return (
      <div className="rounded-lg border bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold">Reschedule Suggestions</h2>
        <div className="flex items-center justify-center py-8">
          <div className="text-sm text-gray-500">Loading...</div>
        </div>
      </div>
    );
  }

  if (!suggestions || suggestions.length === 0) {
    return (
      <div className="rounded-lg border bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold">Reschedule Suggestions</h2>
        <div className="rounded-lg bg-gray-50 p-6 text-center">
          <svg
            className="mx-auto h-10 w-10 text-gray-400"
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
          <p className="mt-2 text-sm text-gray-600">No pending suggestions</p>
          <p className="mt-1 text-xs text-gray-500">
            You'll be notified when weather-related reschedules are suggested
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-white p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Reschedule Suggestions</h2>
        <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-800">
          {suggestions.length} Pending
        </span>
      </div>

      <div className="space-y-3">
        {suggestions.map((suggestion) => {
          const confidencePercentage = Math.round(suggestion.confidence * 100);
          const getConfidenceColor = (confidence: number) => {
            if (confidence >= 0.8) return 'bg-green-100 text-green-800';
            if (confidence >= 0.6) return 'bg-yellow-100 text-yellow-800';
            return 'bg-red-100 text-red-800';
          };

          return (
            <div
              key={suggestion.id}
              className="rounded-lg border border-blue-100 bg-blue-50 p-4 transition-all hover:border-blue-200"
            >
              {/* Booking Info */}
              <div className="mb-2 flex items-start justify-between">
                <div>
                  <div className="text-sm font-medium text-gray-900">
                    {suggestion.booking.departureLocation} →{' '}
                    {suggestion.booking.arrivalLocation}
                  </div>
                  <div className="text-xs text-gray-600">
                    Original: {formatDateTime(suggestion.booking.scheduledStart)}
                  </div>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${getConfidenceColor(suggestion.confidence)}`}
                >
                  {confidencePercentage}%
                </span>
              </div>

              {/* Proposed Time */}
              <div className="mb-2 rounded bg-white px-3 py-2">
                <div className="text-xs font-medium text-gray-700">Suggested Time:</div>
                <div className="text-sm font-semibold text-blue-700">
                  {formatDateTime(suggestion.proposedDateTime)}
                </div>
              </div>

              {/* Reasoning (truncated) */}
              <div className="mb-3 text-xs text-gray-700 line-clamp-2">
                {suggestion.reasoning}
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <Link
                  href={`/student/reschedules?bookingId=${suggestion.bookingId}`}
                  className="flex-1 rounded-md border border-blue-600 bg-white px-3 py-1.5 text-center text-xs font-medium text-blue-600 transition-colors hover:bg-blue-50"
                >
                  View Details
                </Link>
                <button
                  onClick={() => handleQuickConfirm(suggestion.id, suggestion.bookingId)}
                  disabled={confirmMutation.isPending}
                  className="flex-1 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-700 disabled:bg-gray-300"
                >
                  {confirmMutation.isPending ? 'Confirming...' : 'Quick Confirm'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* View All Link */}
      {suggestions.length > 0 && (
        <div className="mt-4 text-center">
          <Link
            href="/student/reschedules"
            className="text-xs font-medium text-blue-600 hover:text-blue-700"
          >
            View All Suggestions →
          </Link>
        </div>
      )}
    </div>
  );
}
