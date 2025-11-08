/**
 * Reschedule Suggestions List Component
 * Displays all AI-generated reschedule suggestions for a booking
 */

'use client';

import { trpc } from '@/lib/trpc/client';
import { SuggestionCard } from './suggestion-card';
import { toast } from 'sonner';

interface SuggestionsListProps {
  bookingId: string;
}

export function SuggestionsList({ bookingId }: SuggestionsListProps) {
  const utils = trpc.useUtils();

  // Fetch suggestions for this booking
  const { data: suggestions, isLoading } = trpc.reschedule.getSuggestions.useQuery({
    bookingId,
  });

  // Confirm mutation
  const confirmMutation = trpc.reschedule.confirm.useMutation({
    onSuccess: () => {
      toast.success('Reschedule confirmed successfully!');
      // Invalidate queries to refresh data
      utils.reschedule.getSuggestions.invalidate({ bookingId });
      utils.reschedule.getPending.invalidate();
      utils.bookings.upcoming.invalidate();
      utils.bookings.getById.invalidate({ id: bookingId });
    },
    onError: (error) => {
      toast.error(`Failed to confirm: ${error.message}`);
    },
  });

  // Decline mutation
  const declineMutation = trpc.reschedule.decline.useMutation({
    onSuccess: () => {
      toast.success('Suggestion declined');
      // Invalidate queries to refresh data
      utils.reschedule.getSuggestions.invalidate({ bookingId });
      utils.reschedule.getPending.invalidate();
    },
    onError: (error) => {
      toast.error(`Failed to decline: ${error.message}`);
    },
  });

  const handleConfirm = async (suggestionId: string) => {
    await confirmMutation.mutateAsync({ suggestionId });
  };

  const handleDecline = async (suggestionId: string, reason?: string) => {
    await declineMutation.mutateAsync({ suggestionId, reason });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-sm text-gray-500">Loading suggestions...</div>
      </div>
    );
  }

  if (!suggestions || suggestions.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center">
        <svg
          className="mx-auto h-12 w-12 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
        <h3 className="mt-2 text-sm font-medium text-gray-900">No suggestions yet</h3>
        <p className="mt-1 text-sm text-gray-500">
          AI-generated reschedule suggestions will appear here when available.
        </p>
      </div>
    );
  }

  // Separate confirmed, pending, and declined suggestions
  const confirmedSuggestions = suggestions.filter((s) => s.isSelected);
  const metadata = suggestions.map((s) => s.metadata as Record<string, any> | null);
  const declinedSuggestions = suggestions.filter((s, i) => metadata[i]?.declined);
  const pendingSuggestions = suggestions.filter(
    (s, i) => !s.isSelected && !metadata[i]?.declined,
  );

  return (
    <div className="space-y-6">
      {/* Statistics */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border bg-white p-4">
          <div className="text-2xl font-bold text-blue-600">{pendingSuggestions.length}</div>
          <div className="text-xs text-gray-600">Pending</div>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <div className="text-2xl font-bold text-green-600">{confirmedSuggestions.length}</div>
          <div className="text-xs text-gray-600">Confirmed</div>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <div className="text-2xl font-bold text-gray-600">{declinedSuggestions.length}</div>
          <div className="text-xs text-gray-600">Declined</div>
        </div>
      </div>

      {/* Pending Suggestions */}
      {pendingSuggestions.length > 0 && (
        <div>
          <h3 className="mb-3 text-lg font-semibold text-gray-900">
            Available Suggestions ({pendingSuggestions.length})
          </h3>
          <div className="space-y-4">
            {pendingSuggestions.map((suggestion) => (
              <SuggestionCard
                key={suggestion.id}
                suggestion={suggestion}
                onConfirm={handleConfirm}
                onDecline={handleDecline}
                isConfirming={confirmMutation.isPending}
                isDeclining={declineMutation.isPending}
              />
            ))}
          </div>
        </div>
      )}

      {/* Confirmed Suggestions */}
      {confirmedSuggestions.length > 0 && (
        <div>
          <h3 className="mb-3 text-lg font-semibold text-gray-900">Confirmed</h3>
          <div className="space-y-4">
            {confirmedSuggestions.map((suggestion) => (
              <SuggestionCard
                key={suggestion.id}
                suggestion={suggestion}
                onConfirm={handleConfirm}
                onDecline={handleDecline}
                isConfirming={false}
                isDeclining={false}
              />
            ))}
          </div>
        </div>
      )}

      {/* Declined Suggestions */}
      {declinedSuggestions.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer text-sm font-medium text-gray-700 hover:text-gray-900">
            View Declined Suggestions ({declinedSuggestions.length})
          </summary>
          <div className="mt-3 space-y-4">
            {declinedSuggestions.map((suggestion) => (
              <SuggestionCard
                key={suggestion.id}
                suggestion={suggestion}
                onConfirm={handleConfirm}
                onDecline={handleDecline}
                isConfirming={false}
                isDeclining={false}
              />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
