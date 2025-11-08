import { addMinutes } from 'date-fns';
import type { Waypoint } from './types';

// Constants
const EARTH_RADIUS_NM = 3440.065; // Earth radius in nautical miles
const WAYPOINT_INTERVAL_MINUTES = 30;
const AVERAGE_SPEED_KNOTS = 100; // Average training aircraft speed in knots
const LOCAL_FLIGHT_RADIUS_NM = 25; // Radius for local flight pattern

/**
 * Convert degrees to radians
 */
function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Convert radians to degrees
 */
function toDegrees(radians: number): number {
  return radians * (180 / Math.PI);
}

/**
 * Calculate distance between two points using Haversine formula
 * @param lat1 - Latitude of first point in degrees
 * @param lon1 - Longitude of first point in degrees
 * @param lat2 - Latitude of second point in degrees
 * @param lon2 - Longitude of second point in degrees
 * @returns Distance in nautical miles
 */
export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const φ1 = toRadians(lat1);
  const φ2 = toRadians(lat2);
  const Δφ = toRadians(lat2 - lat1);
  const Δλ = toRadians(lon2 - lon1);

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_NM * c;
}

/**
 * Calculate intermediate point along great-circle route
 * @param lat1 - Start latitude in degrees
 * @param lon1 - Start longitude in degrees
 * @param lat2 - End latitude in degrees
 * @param lon2 - End longitude in degrees
 * @param fraction - Fraction of distance (0.0 to 1.0)
 * @returns Intermediate point [lat, lon]
 */
export function intermediatePoint(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
  fraction: number
): [number, number] {
  const φ1 = toRadians(lat1);
  const λ1 = toRadians(lon1);
  const φ2 = toRadians(lat2);
  const λ2 = toRadians(lon2);

  const distance = haversineDistance(lat1, lon1, lat2, lon2) / EARTH_RADIUS_NM; // angular distance in radians

  const a = Math.sin((1 - fraction) * distance) / Math.sin(distance);
  const b = Math.sin(fraction * distance) / Math.sin(distance);

  const x = a * Math.cos(φ1) * Math.cos(λ1) + b * Math.cos(φ2) * Math.cos(λ2);
  const y = a * Math.cos(φ1) * Math.sin(λ1) + b * Math.cos(φ2) * Math.sin(λ2);
  const z = a * Math.sin(φ1) + b * Math.sin(φ2);

  const φ3 = Math.atan2(z, Math.sqrt(x * x + y * y));
  const λ3 = Math.atan2(y, x);

  return [toDegrees(φ3), toDegrees(λ3)];
}

/**
 * Generate waypoints along a great-circle route
 * @param departureLat - Departure latitude
 * @param departureLon - Departure longitude
 * @param arrivalLat - Arrival latitude
 * @param arrivalLon - Arrival longitude
 * @param startTime - Flight start time
 * @param durationMinutes - Total flight duration
 * @returns Array of waypoints
 */
export function generateGreatCircleWaypoints(
  departureLat: number,
  departureLon: number,
  arrivalLat: number,
  arrivalLon: number,
  startTime: Date,
  durationMinutes: number
): Waypoint[] {
  const waypoints: Waypoint[] = [];

  // Always include departure point
  waypoints.push({
    lat: departureLat,
    lon: departureLon,
    timestamp: startTime,
  });

  // Calculate number of intermediate waypoints based on duration
  const numIntervals = Math.floor(durationMinutes / WAYPOINT_INTERVAL_MINUTES);

  // Generate intermediate waypoints
  for (let i = 1; i < numIntervals; i++) {
    const fraction = i / numIntervals;
    const [lat, lon] = intermediatePoint(
      departureLat,
      departureLon,
      arrivalLat,
      arrivalLon,
      fraction
    );

    waypoints.push({
      lat,
      lon,
      timestamp: addMinutes(startTime, i * WAYPOINT_INTERVAL_MINUTES),
    });
  }

  // Always include arrival point
  waypoints.push({
    lat: arrivalLat,
    lon: arrivalLon,
    timestamp: addMinutes(startTime, durationMinutes),
  });

  return waypoints;
}

/**
 * Generate waypoints for a circular local flight pattern
 * Used when departure and arrival are the same or very close
 * @param centerLat - Center point latitude
 * @param centerLon - Center point longitude
 * @param startTime - Flight start time
 * @param durationMinutes - Total flight duration
 * @param radiusNM - Radius of the pattern in nautical miles (default 25)
 * @returns Array of waypoints in a circular pattern
 */
export function generateLocalFlightWaypoints(
  centerLat: number,
  centerLon: number,
  startTime: Date,
  durationMinutes: number,
  radiusNM: number = LOCAL_FLIGHT_RADIUS_NM
): Waypoint[] {
  const waypoints: Waypoint[] = [];

  // Number of waypoints based on duration
  const numWaypoints = Math.ceil(durationMinutes / WAYPOINT_INTERVAL_MINUTES) + 1;

  // Generate waypoints in a circular pattern
  for (let i = 0; i < numWaypoints; i++) {
    const angle = (i * 360) / (numWaypoints - 1); // Degrees around the circle
    const bearing = toRadians(angle);

    // Calculate point at bearing and distance from center
    const φ1 = toRadians(centerLat);
    const λ1 = toRadians(centerLon);
    const δ = radiusNM / EARTH_RADIUS_NM; // angular distance

    const φ2 = Math.asin(
      Math.sin(φ1) * Math.cos(δ) +
        Math.cos(φ1) * Math.sin(δ) * Math.cos(bearing)
    );

    const λ2 =
      λ1 +
      Math.atan2(
        Math.sin(bearing) * Math.sin(δ) * Math.cos(φ1),
        Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2)
      );

    waypoints.push({
      lat: toDegrees(φ2),
      lon: toDegrees(λ2),
      timestamp: addMinutes(startTime, i * WAYPOINT_INTERVAL_MINUTES),
    });
  }

  return waypoints;
}

/**
 * Parse airport code or coordinate string
 * Returns [lat, lon] if valid coordinates, null if airport code (needs lookup)
 */
export function parseLocation(location: string): [number, number] | null {
  // Check if it's coordinates in format "lat,lon"
  const coordMatch = location.match(/^(-?\d+\.?\d*),\s*(-?\d+\.?\d*)$/);
  if (coordMatch) {
    const lat = parseFloat(coordMatch[1]);
    const lon = parseFloat(coordMatch[2]);
    if (lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
      return [lat, lon];
    }
  }

  // If it's an airport code, return null (caller needs to look it up)
  return null;
}

/**
 * Main waypoint calculation function
 * Automatically chooses between great-circle or local flight pattern
 * @param departureLocation - Airport code or "lat,lon" string
 * @param arrivalLocation - Airport code or "lat,lon" string
 * @param startTime - Flight start time
 * @param durationMinutes - Total flight duration
 * @returns Array of waypoints
 */
export function calculateWaypoints(
  departureLocation: string,
  arrivalLocation: string,
  startTime: Date,
  durationMinutes: number
): Waypoint[] {
  const depCoords = parseLocation(departureLocation);
  const arrCoords = parseLocation(arrivalLocation);

  if (!depCoords || !arrCoords) {
    throw new Error(
      'Airport code lookup not implemented. Please use coordinates in "lat,lon" format.'
    );
  }

  const [depLat, depLon] = depCoords;
  const [arrLat, arrLon] = arrCoords;

  // Calculate distance between departure and arrival
  const distance = haversineDistance(depLat, depLon, arrLat, arrLon);

  // If distance is less than 5 NM, treat as local flight
  if (distance < 5) {
    return generateLocalFlightWaypoints(depLat, depLon, startTime, durationMinutes);
  }

  // Otherwise, use great-circle route
  return generateGreatCircleWaypoints(
    depLat,
    depLon,
    arrLat,
    arrLon,
    startTime,
    durationMinutes
  );
}
