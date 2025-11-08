'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc/client';
import { toast } from 'sonner';

interface ManualCheckWidgetProps {
  bookingId: string;
  onCheckComplete?: () => void;
}

export function ManualCheckWidget({ bookingId, onCheckComplete }: ManualCheckWidgetProps) {
  const [isChecking, setIsChecking] = useState(false);

  const manualCheckMutation = trpc.weather.manualCheck.useMutation({
    onSuccess: (data) => {
      if (data.safe) {
        toast.success('Weather check passed', {
          description: `All ${data.waypointCount} waypoints are safe for flight.`,
        });
      } else {
        toast.warning('Weather conditions unsafe', {
          description: `Booking status updated to ${data.updatedBookingStatus}`,
        });
      }
      onCheckComplete?.();
    },
    onError: (error) => {
      toast.error('Weather check failed', {
        description: error.message,
      });
    },
    onSettled: () => {
      setIsChecking(false);
    },
  });

  const handleCheck = () => {
    setIsChecking(true);
    manualCheckMutation.mutate({ bookingId });
  };

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Manual Weather Check</h3>
          <p className="text-sm text-muted-foreground">
            Trigger an immediate weather evaluation for this flight
          </p>
        </div>
        <button
          onClick={handleCheck}
          disabled={isChecking}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {isChecking ? 'Checking...' : 'Check Weather'}
        </button>
      </div>

      {manualCheckMutation.data && (
        <div className="mt-4 space-y-2 rounded-md bg-muted p-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="font-medium">Overall Status:</span>
            <span
              className={`rounded-full px-2 py-1 text-xs font-semibold ${
                manualCheckMutation.data.overallStatus === 'SAFE'
                  ? 'bg-green-100 text-green-800'
                  : manualCheckMutation.data.overallStatus === 'MARGINAL'
                  ? 'bg-yellow-100 text-yellow-800'
                  : 'bg-red-100 text-red-800'
              }`}
            >
              {manualCheckMutation.data.overallStatus}
            </span>
          </div>

          <div>
            <span className="font-medium">Waypoints Checked:</span>{' '}
            {manualCheckMutation.data.waypointCount}
          </div>

          {manualCheckMutation.data.violationSummary.length > 0 && (
            <div>
              <span className="font-medium">Violations:</span>
              <ul className="ml-4 mt-1 list-disc space-y-1">
                {manualCheckMutation.data.violationSummary.map((violation, i) => (
                  <li key={i} className="text-muted-foreground">
                    {violation}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {manualCheckMutation.data.violationReasons.length > 0 && (
            <div className="mt-2">
              <span className="font-medium">Detailed Violations:</span>
              <ul className="ml-4 mt-1 list-disc space-y-1">
                {manualCheckMutation.data.violationReasons.map((reason, i) => (
                  <li key={i} className="text-xs text-muted-foreground">
                    {reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
