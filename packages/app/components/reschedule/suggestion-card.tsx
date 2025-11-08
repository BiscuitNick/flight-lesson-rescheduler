/**
 * Reschedule Suggestion Card Component
 * Displays individual AI-generated reschedule suggestions with actions
 */

'use client';

import { formatDateTime } from '@/lib/utils';
import type { RescheduleSuggestion } from '@/lib/server/services/reschedule.service';
import { useState } from 'react';

interface SuggestionCardProps {
  suggestion: RescheduleSuggestion;
  onConfirm: (suggestionId: string) => Promise<void>;
  onDecline: (suggestionId: string, reason?: string) => Promise<void>;
  isConfirming: boolean;
  isDeclining: boolean;
}

export function SuggestionCard({
  suggestion,
  onConfirm,
  onDecline,
  isConfirming,
  isDeclining,
}: SuggestionCardProps) {
  const [showDeclineReason, setShowDeclineReason] = useState(false);
  const [declineReason, setDeclineReason] = useState('');

  const handleConfirm = async () => {
    if (confirm('Are you sure you want to confirm this reschedule suggestion?')) {
      await onConfirm(suggestion.id);
    }
  };

  const handleDecline = async () => {
    if (showDeclineReason) {
      await onDecline(suggestion.id, declineReason || undefined);
      setShowDeclineReason(false);
      setDeclineReason('');
    } else {
      setShowDeclineReason(true);
    }
  };

  // Get confidence color
  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return '#10b981'; // green
    if (confidence >= 0.6) return '#f59e0b'; // amber
    return '#ef4444'; // red
  };

  const confidenceColor = getConfidenceColor(suggestion.confidence);
  const confidencePercentage = Math.round(suggestion.confidence * 100);

  // Check if already selected
  if (suggestion.isSelected) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-4">
        <div className="flex items-start gap-3">
          <div className="mt-1 flex h-6 w-6 items-center justify-center rounded-full bg-green-600 text-white">
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <div className="flex-1">
            <div className="font-semibold text-green-900">Confirmed</div>
            <div className="mt-1 text-sm text-green-700">
              {formatDateTime(suggestion.proposedDateTime)}
            </div>
            <div className="mt-2 text-xs text-green-600">
              Confirmed on {suggestion.selectedAt ? formatDateTime(suggestion.selectedAt) : 'Unknown'}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Check if declined
  const metadata = suggestion.metadata as Record<string, any> | null;
  if (metadata?.declined) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 opacity-60">
        <div className="flex items-start gap-3">
          <div className="mt-1 flex h-6 w-6 items-center justify-center rounded-full bg-gray-400 text-white">
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </div>
          <div className="flex-1">
            <div className="font-semibold text-gray-700">Declined</div>
            <div className="mt-1 text-sm text-gray-600">
              {formatDateTime(suggestion.proposedDateTime)}
            </div>
            {metadata.declineReason && (
              <div className="mt-2 text-xs text-gray-500">
                Reason: {metadata.declineReason}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition-all hover:shadow-md">
      {/* Header with proposed date/time and confidence */}
      <div className="flex items-start justify-between">
        <div>
          <div className="text-lg font-semibold text-gray-900">
            {formatDateTime(suggestion.proposedDateTime)}
          </div>
          <div className="mt-1 text-xs text-gray-500">
            Suggested on {formatDateTime(suggestion.createdAt)}
          </div>
        </div>
        <div className="flex flex-col items-end">
          <div
            className="rounded-full px-3 py-1 text-xs font-medium text-white"
            style={{ backgroundColor: confidenceColor }}
          >
            {confidencePercentage}% Confidence
          </div>
        </div>
      </div>

      {/* AI Reasoning */}
      <div className="mt-4">
        <div className="text-sm font-medium text-gray-700">AI Analysis:</div>
        <div className="mt-1 rounded-lg bg-gray-50 p-3 text-sm text-gray-700">
          {suggestion.reasoning}
        </div>
      </div>

      {/* Flight Details Preview */}
      <div className="mt-4 flex flex-wrap gap-4 text-xs text-gray-600">
        <div>
          <span className="font-medium">Route:</span>{' '}
          {suggestion.booking.departureLocation} → {suggestion.booking.arrivalLocation}
        </div>
        <div>
          <span className="font-medium">Instructor:</span> {suggestion.booking.instructor.name}
        </div>
      </div>

      {/* Decline Reason Input */}
      {showDeclineReason && (
        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700">
            Decline Reason (optional)
          </label>
          <textarea
            value={declineReason}
            onChange={(e) => setDeclineReason(e.target.value)}
            className="mt-1 w-full rounded-md border border-gray-300 p-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            rows={2}
            placeholder="Why are you declining this suggestion?"
          />
        </div>
      )}

      {/* Actions */}
      <div className="mt-4 flex gap-2">
        <button
          onClick={handleConfirm}
          disabled={isConfirming || isDeclining}
          className="flex-1 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          {isConfirming ? 'Confirming...' : 'Confirm'}
        </button>
        <button
          onClick={handleDecline}
          disabled={isConfirming || isDeclining}
          className="flex-1 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed"
        >
          {isDeclining ? 'Declining...' : showDeclineReason ? 'Submit' : 'Decline'}
        </button>
        {showDeclineReason && (
          <button
            onClick={() => {
              setShowDeclineReason(false);
              setDeclineReason('');
            }}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
