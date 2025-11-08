'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc/client';

export function RouteChecker() {
  const [formData, setFormData] = useState({
    departureLocation: '',
    arrivalLocation: '',
    scheduledStart: '',
    duration: '',
    trainingLevel: 'STUDENT_PILOT' as 'STUDENT_PILOT' | 'PRIVATE_PILOT' | 'INSTRUMENT_RATED',
  });

  const [result, setResult] = useState<any>(null);
  const [isChecking, setIsChecking] = useState(false);

  const checkRoute = trpc.weather.checkRoute.useQuery(
    {
      departureLocation: formData.departureLocation,
      arrivalLocation: formData.arrivalLocation,
      scheduledStart: new Date(formData.scheduledStart),
      duration: parseInt(formData.duration),
      trainingLevel: formData.trainingLevel,
    },
    {
      enabled: false,
      onSuccess: (data) => {
        setResult(data);
        setIsChecking(false);
      },
      onError: () => {
        setIsChecking(false);
      },
    }
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsChecking(true);
    setResult(null);
    checkRoute.refetch();
  };

  return (
    <div className="rounded-lg border bg-card p-6">
      <h3 className="mb-4 text-lg font-semibold">Route Weather Checker</h3>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Departure (lat,lon)</label>
            <input
              type="text"
              value={formData.departureLocation}
              onChange={(e) =>
                setFormData({ ...formData, departureLocation: e.target.value })
              }
              placeholder="40.7128,-74.0060"
              className="w-full rounded-md border px-3 py-2 text-sm"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Arrival (lat,lon)</label>
            <input
              type="text"
              value={formData.arrivalLocation}
              onChange={(e) => setFormData({ ...formData, arrivalLocation: e.target.value })}
              placeholder="40.7614,-73.9776"
              className="w-full rounded-md border px-3 py-2 text-sm"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Start Time</label>
            <input
              type="datetime-local"
              value={formData.scheduledStart}
              onChange={(e) => setFormData({ ...formData, scheduledStart: e.target.value })}
              className="w-full rounded-md border px-3 py-2 text-sm"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Duration (minutes)</label>
            <input
              type="number"
              value={formData.duration}
              onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
              placeholder="60"
              className="w-full rounded-md border px-3 py-2 text-sm"
              required
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Training Level</label>
          <select
            value={formData.trainingLevel}
            onChange={(e) =>
              setFormData({
                ...formData,
                trainingLevel: e.target.value as typeof formData.trainingLevel,
              })
            }
            className="w-full rounded-md border px-3 py-2 text-sm"
          >
            <option value="STUDENT_PILOT">Student Pilot</option>
            <option value="PRIVATE_PILOT">Private Pilot</option>
            <option value="INSTRUMENT_RATED">Instrument Rated</option>
          </select>
        </div>

        <button
          type="submit"
          disabled={isChecking}
          className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {isChecking ? 'Checking Weather...' : 'Check Route'}
        </button>
      </form>

      {result && (
        <div className="mt-6 space-y-4 rounded-md bg-muted p-4">
          <div className="flex items-center justify-between">
            <span className="font-semibold">Route Status:</span>
            <span
              className={`rounded-full px-3 py-1 text-sm font-semibold ${
                result.overallStatus === 'SAFE'
                  ? 'bg-green-100 text-green-800'
                  : result.overallStatus === 'MARGINAL'
                  ? 'bg-yellow-100 text-yellow-800'
                  : 'bg-red-100 text-red-800'
              }`}
            >
              {result.overallStatus}
            </span>
          </div>

          {result.violationSummary.length > 0 && (
            <div>
              <h4 className="mb-2 font-semibold">Violations Summary:</h4>
              <ul className="ml-4 list-disc space-y-1 text-sm">
                {result.violationSummary.map((v: string, i: number) => (
                  <li key={i}>{v}</li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <h4 className="mb-2 font-semibold">Waypoint Details:</h4>
            <div className="max-h-60 overflow-y-auto space-y-2">
              {result.waypoints.map((wp: any) => (
                <div
                  key={wp.index}
                  className={`rounded-md p-2 text-sm ${
                    wp.safe ? 'bg-green-50' : 'bg-red-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Waypoint {wp.index}</span>
                    <span className={wp.safe ? 'text-green-700' : 'text-red-700'}>
                      {wp.safe ? '✓ Safe' : '✗ Unsafe'}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Visibility: {wp.visibility.toFixed(1)} SM | Ceiling: {wp.ceiling} ft | Wind:{' '}
                    {wp.windSpeed.toFixed(0)} kts
                    {wp.windGust ? ` (G${wp.windGust.toFixed(0)})` : ''}
                  </div>
                  {wp.violations.length > 0 && (
                    <div className="mt-1 text-xs text-red-700">
                      {wp.violations.join(', ')}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
