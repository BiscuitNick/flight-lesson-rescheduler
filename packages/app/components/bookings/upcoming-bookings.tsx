/**
 * Upcoming Bookings Component
 * Shows upcoming bookings for the current user with quick actions
 */

'use client';

import { trpc } from '@/lib/trpc/client';
import { formatDateTime, formatDuration, formatFlightRoute, getBookingStatusColor, getBookingStatusLabel } from '@/lib/utils';
import { useState } from 'react';
import type { BookingStatus } from '@prisma/client';

export function UpcomingBookings() {
  const utils = trpc.useUtils();
  const { data: bookings, isLoading } = trpc.bookings.upcoming.useQuery();

  const cancelMutation = trpc.bookings.cancel.useMutation({
    onSuccess: () => {
      // Invalidate and refetch
      utils.bookings.upcoming.invalidate();
      utils.bookings.stats.invalidate();
    },
  });

  const handleCancel = async (bookingId: string) => {
    if (confirm('Are you sure you want to cancel this booking?')) {
      await cancelMutation.mutateAsync({ id: bookingId });
    }
  };

  if (isLoading) {
    return (
      <div className="rounded-lg border bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold">Upcoming Lessons</h2>
        <div className="flex items-center justify-center py-8">
          <div className="text-sm text-gray-500">Loading...</div>
        </div>
      </div>
    );
  }

  if (!bookings || bookings.length === 0) {
    return (
      <div className="rounded-lg border bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold">Upcoming Lessons</h2>
        <div className="rounded-lg bg-gray-50 p-8 text-center">
          <p className="text-sm text-gray-600">No upcoming bookings</p>
          <p className="mt-1 text-xs text-gray-500">Book a lesson to get started!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-white p-6">
      <h2 className="mb-4 text-lg font-semibold">Upcoming Lessons</h2>
      <div className="space-y-3">
        {bookings.map((booking) => (
          <UpcomingBookingCard
            key={booking.id}
            booking={booking}
            onCancel={handleCancel}
            isCanceling={cancelMutation.isPending}
          />
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// UPCOMING BOOKING CARD
// ============================================================================

interface UpcomingBookingCardProps {
  booking: any;
  onCancel: (id: string) => void;
  isCanceling: boolean;
}

function UpcomingBookingCard({ booking, onCancel, isCanceling }: UpcomingBookingCardProps) {
  const statusColor = getBookingStatusColor(booking.status);
  const canCancel = booking.status !== 'CANCELLED' && booking.status !== 'COMPLETED';

  return (
    <div className="flex items-start gap-4 rounded-lg border p-4 transition-colors hover:bg-gray-50">
      {/* Date Badge */}
      <div className="flex flex-col items-center rounded-lg bg-blue-50 p-3 text-center">
        <div className="text-2xl font-bold text-blue-700">
          {new Date(booking.scheduledStart).getDate()}
        </div>
        <div className="text-xs font-medium text-blue-600">
          {new Date(booking.scheduledStart).toLocaleDateString('en-US', { month: 'short' })}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 space-y-2">
        <div className="flex items-start justify-between">
          <div>
            <div className="font-semibold text-gray-900">
              {formatFlightRoute(booking.departureLocation, booking.arrivalLocation)}
            </div>
            <div className="text-sm text-gray-600">
              with {booking.instructor.name}
            </div>
          </div>
          <span
            className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
            style={{
              backgroundColor: `${statusColor}20`,
              color: statusColor,
            }}
          >
            {getBookingStatusLabel(booking.status)}
          </span>
        </div>

        <div className="flex flex-wrap gap-4 text-xs text-gray-600">
          <div>
            <span className="font-medium">Time:</span> {formatDateTime(booking.scheduledStart)}
          </div>
          <div>
            <span className="font-medium">Duration:</span> {formatDuration(booking.duration)}
          </div>
          <div>
            <span className="font-medium">Type:</span> {booking.flightType}
          </div>
        </div>

        {canCancel && (
          <button
            onClick={() => onCancel(booking.id)}
            disabled={isCanceling}
            className="text-xs text-red-600 hover:text-red-700 disabled:opacity-50"
          >
            Cancel Booking
          </button>
        )}
      </div>
    </div>
  );
}
