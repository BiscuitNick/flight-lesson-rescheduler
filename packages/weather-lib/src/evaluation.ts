import type { WeatherCondition, WeatherMinimum, Waypoint, TrainingLevel } from './types';
import { WEATHER_MINIMUMS } from './minimums';

export interface WaypointWeatherData {
  waypoint: Waypoint;
  weather: WeatherCondition;
}

export interface WeatherViolation {
  type: 'VISIBILITY' | 'CEILING' | 'WIND_SPEED' | 'WIND_GUST' | 'PROHIBITED_CONDITION';
  reason: string;
  actual: number | string;
  required: number | string;
}

export interface WaypointEvaluation {
  waypoint: Waypoint;
  weather: WeatherCondition;
  safe: boolean;
  violations: WeatherViolation[];
}

export interface RouteEvaluation {
  safe: boolean;
  overallStatus: 'SAFE' | 'MARGINAL' | 'UNSAFE';
  waypoints: WaypointEvaluation[];
  violationSummary: string[];
}

/**
 * Evaluate weather conditions at a single waypoint against training level minimums
 * @param waypoint - The waypoint location and time
 * @param weather - Weather conditions at the waypoint
 * @param trainingLevel - Student's training level
 * @returns Evaluation result with safety status and any violations
 */
export function evaluateWaypoint(
  waypoint: Waypoint,
  weather: WeatherCondition,
  trainingLevel: TrainingLevel
): WaypointEvaluation {
  const minimums = WEATHER_MINIMUMS[trainingLevel];
  const violations: WeatherViolation[] = [];

  // Check visibility
  if (weather.visibility < minimums.visibility) {
    violations.push({
      type: 'VISIBILITY',
      reason: `Visibility ${weather.visibility} SM is below minimum ${minimums.visibility} SM`,
      actual: weather.visibility,
      required: minimums.visibility,
    });
  }

  // Check ceiling
  if (weather.ceiling < minimums.ceiling) {
    violations.push({
      type: 'CEILING',
      reason: `Ceiling ${weather.ceiling} ft is below minimum ${minimums.ceiling} ft`,
      actual: weather.ceiling,
      required: minimums.ceiling,
    });
  }

  // Check wind speed
  if (weather.windSpeed > minimums.windSpeed) {
    violations.push({
      type: 'WIND_SPEED',
      reason: `Wind speed ${weather.windSpeed} kts exceeds maximum ${minimums.windSpeed} kts`,
      actual: weather.windSpeed,
      required: minimums.windSpeed,
    });
  }

  // Check wind gusts
  if (weather.windGust && weather.windGust > minimums.windGust) {
    violations.push({
      type: 'WIND_GUST',
      reason: `Wind gust ${weather.windGust} kts exceeds maximum ${minimums.windGust} kts`,
      actual: weather.windGust,
      required: minimums.windGust,
    });
  }

  // Check for prohibited conditions
  for (const condition of weather.conditions) {
    // Case-insensitive check for prohibited conditions
    const normalizedCondition = condition.toLowerCase();
    const hasProhibited = minimums.prohibitedConditions.some(
      (prohibited) => normalizedCondition.includes(prohibited.toLowerCase())
    );

    if (hasProhibited) {
      violations.push({
        type: 'PROHIBITED_CONDITION',
        reason: `Prohibited weather condition present: ${condition}`,
        actual: condition,
        required: 'None',
      });
    }
  }

  return {
    waypoint,
    weather,
    safe: violations.length === 0,
    violations,
  };
}

/**
 * Evaluate weather conditions along an entire route
 * @param waypointsWithWeather - Array of waypoints with their weather data
 * @param trainingLevel - Student's training level
 * @returns Overall route evaluation with detailed waypoint results
 */
export function evaluateRoute(
  waypointsWithWeather: WaypointWeatherData[],
  trainingLevel: TrainingLevel
): RouteEvaluation {
  const evaluations: WaypointEvaluation[] = waypointsWithWeather.map(({ waypoint, weather }) =>
    evaluateWaypoint(waypoint, weather, trainingLevel)
  );

  const unsafeCount = evaluations.filter((e) => !e.safe).length;
  const totalCount = evaluations.length;

  // Determine overall safety status
  let overallStatus: 'SAFE' | 'MARGINAL' | 'UNSAFE';
  if (unsafeCount === 0) {
    overallStatus = 'SAFE';
  } else if (unsafeCount < totalCount / 2) {
    overallStatus = 'MARGINAL';
  } else {
    overallStatus = 'UNSAFE';
  }

  // Generate violation summary
  const violationTypes = new Set<string>();
  evaluations.forEach((evaluation) => {
    evaluation.violations.forEach((violation) => {
      violationTypes.add(violation.type);
    });
  });

  const violationSummary = Array.from(violationTypes).map((type) => {
    const count = evaluations.reduce((sum, e) => {
      return sum + e.violations.filter((v) => v.type === type).length;
    }, 0);
    return `${type}: ${count} waypoint${count > 1 ? 's' : ''}`;
  });

  return {
    safe: unsafeCount === 0,
    overallStatus,
    waypoints: evaluations,
    violationSummary,
  };
}

/**
 * Get detailed violation reasons from a route evaluation
 * @param routeEvaluation - The route evaluation result
 * @returns Array of human-readable violation descriptions
 */
export function getViolationReasons(routeEvaluation: RouteEvaluation): string[] {
  const reasons: string[] = [];
  const reasonSet = new Set<string>();

  routeEvaluation.waypoints.forEach((evaluation, index) => {
    if (!evaluation.safe) {
      evaluation.violations.forEach((violation) => {
        const reason = `Waypoint ${index + 1}: ${violation.reason}`;
        if (!reasonSet.has(reason)) {
          reasonSet.add(reason);
          reasons.push(reason);
        }
      });
    }
  });

  return reasons;
}

/**
 * Check if weather conditions meet minimums for a specific training level
 * Convenience function for simple checks without waypoint context
 * @param weather - Weather conditions to check
 * @param trainingLevel - Student's training level
 * @returns True if weather meets minimums, false otherwise
 */
export function meetsMinimums(
  weather: WeatherCondition,
  trainingLevel: TrainingLevel
): boolean {
  const minimums = WEATHER_MINIMUMS[trainingLevel];

  // Check visibility
  if (weather.visibility < minimums.visibility) return false;

  // Check ceiling
  if (weather.ceiling < minimums.ceiling) return false;

  // Check wind speed
  if (weather.windSpeed > minimums.windSpeed) return false;

  // Check wind gusts
  if (weather.windGust && weather.windGust > minimums.windGust) return false;

  // Check for prohibited conditions
  for (const condition of weather.conditions) {
    const normalizedCondition = condition.toLowerCase();
    const hasProhibited = minimums.prohibitedConditions.some(
      (prohibited) => normalizedCondition.includes(prohibited.toLowerCase())
    );
    if (hasProhibited) return false;
  }

  return true;
}
