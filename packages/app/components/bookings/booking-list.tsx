/**
 * Booking List Component
 * Displays bookings in a table/card format with RBAC-aware filtering
 */

'use client';

import { trpc } from '@/lib/trpc/client';
import { formatDateTime, formatDuration, formatFlightRoute, getBookingStatusLabel, getBookingStatusColor } from '@/lib/utils';
import type { BookingStatus } from '@prisma/client';

interface BookingListProps {
  status?: BookingStatus;
  limit?: number;
}

export function BookingList({ status, limit }: BookingListProps) {
  const { data: bookings, isLoading, error } = trpc.bookings.list.useQuery({
    status,
  });

  const { data: stats } = trpc.bookings.stats.useQuery();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-sm text-gray-500">Loading bookings...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4">
        <p className="text-sm text-red-800">Error loading bookings: {error.message}</p>
      </div>
    );
  }

  const displayBookings = limit ? bookings?.slice(0, limit) : bookings;

  if (!displayBookings || displayBookings.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-12 text-center">
        <p className="text-sm text-gray-600">No bookings found</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats Summary */}
      {stats && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <StatCard label="Total" value={stats.total} />
          <StatCard label="Scheduled" value={stats.byStatus.scheduled} color="blue" />
          <StatCard label="Weather Hold" value={stats.byStatus.weatherHold} color="yellow" />
          <StatCard label="Awaiting" value={stats.byStatus.awaitingResponse} color="amber" />
          <StatCard label="Confirmed" value={stats.byStatus.confirmed} color="green" />
          <StatCard label="Completed" value={stats.byStatus.completed} color="gray" />
        </div>
      )}

      {/* Booking Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {displayBookings.map((booking) => (
          <BookingCard key={booking.id} booking={booking} />
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// BOOKING CARD
// ============================================================================

interface BookingCardProps {
  booking: any; // TODO: Type properly
}

function BookingCard({ booking }: BookingCardProps) {
  const statusColor = getBookingStatusColor(booking.status);

  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
      {/* Header */}
      <div className="mb-3 flex items-start justify-between">
        <div>
          <h3 className="font-semibold text-gray-900">{booking.student.name}</h3>
          <p className="text-sm text-gray-600">{booking.instructor.name}</p>
        </div>
        <StatusBadge status={booking.status} color={statusColor} />
      </div>

      {/* Flight Details */}
      <div className="space-y-2 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-gray-600">Route:</span>
          <span className="font-medium">{formatFlightRoute(booking.departureLocation, booking.arrivalLocation)}</span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-gray-600">Type:</span>
          <span className="font-medium">{booking.flightType}</span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-gray-600">Duration:</span>
          <span className="font-medium">{formatDuration(booking.duration)}</span>
        </div>

        <div className="mt-3 border-t pt-3">
          <div className="text-xs text-gray-500">
            {formatDateTime(booking.scheduledStart)}
          </div>
        </div>
      </div>

      {/* Notes */}
      {booking.notes && (
        <div className="mt-3 border-t pt-3">
          <p className="text-xs text-gray-600">{booking.notes}</p>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// HELPERS
// ============================================================================

interface StatCardProps {
  label: string;
  value: number;
  color?: 'blue' | 'yellow' | 'amber' | 'green' | 'gray';
}

function StatCard({ label, value, color = 'gray' }: StatCardProps) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    yellow: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    green: 'bg-green-50 text-green-700 border-green-200',
    gray: 'bg-gray-50 text-gray-700 border-gray-200',
  };

  return (
    <div className={`rounded-lg border p-3 ${colorClasses[color]}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs font-medium">{label}</div>
    </div>
  );
}

interface StatusBadgeProps {
  status: BookingStatus;
  color: string;
}

function StatusBadge({ status, color }: StatusBadgeProps) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
      style={{
        backgroundColor: `${color}20`,
        color: color,
      }}
    >
      {getBookingStatusLabel(status)}
    </span>
  );
}
