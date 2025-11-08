import { describe, it, expect } from 'vitest';
import {
  evaluateWaypoint,
  evaluateRoute,
  getViolationReasons,
  meetsMinimums,
  type WaypointWeatherData,
} from '../evaluation';
import type { WeatherCondition, Waypoint } from '../types';

describe('evaluation', () => {
  const createWeather = (overrides?: Partial<WeatherCondition>): WeatherCondition => ({
    visibility: 10,
    ceiling: 5000,
    windSpeed: 8,
    windGust: 12,
    conditions: ['Clear'],
    ...overrides,
  });

  const createWaypoint = (overrides?: Partial<Waypoint>): Waypoint => ({
    lat: 40.7128,
    lon: -74.006,
    timestamp: new Date('2025-01-01T10:00:00Z'),
    ...overrides,
  });

  describe('evaluateWaypoint', () => {
    describe('STUDENT_PILOT minimums', () => {
      it('passes with good weather', () => {
        const waypoint = createWaypoint();
        const weather = createWeather({
          visibility: 10,
          ceiling: 5000,
          windSpeed: 8,
          conditions: ['Clear'],
        });

        const result = evaluateWaypoint(waypoint, weather, 'STUDENT_PILOT');

        expect(result.safe).toBe(true);
        expect(result.violations).toHaveLength(0);
      });

      it('fails with low visibility', () => {
        const waypoint = createWaypoint();
        const weather = createWeather({ visibility: 3 });

        const result = evaluateWaypoint(waypoint, weather, 'STUDENT_PILOT');

        expect(result.safe).toBe(false);
        expect(result.violations).toHaveLength(1);
        expect(result.violations[0].type).toBe('VISIBILITY');
        expect(result.violations[0].actual).toBe(3);
        expect(result.violations[0].required).toBe(5);
      });

      it('fails with low ceiling', () => {
        const waypoint = createWaypoint();
        const weather = createWeather({ ceiling: 2000 });

        const result = evaluateWaypoint(waypoint, weather, 'STUDENT_PILOT');

        expect(result.safe).toBe(false);
        expect(result.violations[0].type).toBe('CEILING');
      });

      it('fails with high wind speed', () => {
        const waypoint = createWaypoint();
        const weather = createWeather({ windSpeed: 15 });

        const result = evaluateWaypoint(waypoint, weather, 'STUDENT_PILOT');

        expect(result.safe).toBe(false);
        expect(result.violations[0].type).toBe('WIND_SPEED');
      });

      it('fails with high wind gusts', () => {
        const waypoint = createWaypoint();
        const weather = createWeather({ windGust: 20 });

        const result = evaluateWaypoint(waypoint, weather, 'STUDENT_PILOT');

        expect(result.safe).toBe(false);
        expect(result.violations[0].type).toBe('WIND_GUST');
      });

      it('fails with thunderstorm', () => {
        const waypoint = createWaypoint();
        const weather = createWeather({ conditions: ['Thunderstorm'] });

        const result = evaluateWaypoint(waypoint, weather, 'STUDENT_PILOT');

        expect(result.safe).toBe(false);
        expect(result.violations[0].type).toBe('PROHIBITED_CONDITION');
      });

      it('fails with fog', () => {
        const waypoint = createWaypoint();
        const weather = createWeather({ conditions: ['Fog'] });

        const result = evaluateWaypoint(waypoint, weather, 'STUDENT_PILOT');

        expect(result.safe).toBe(false);
        expect(result.violations[0].type).toBe('PROHIBITED_CONDITION');
      });

      it('handles multiple violations', () => {
        const waypoint = createWaypoint();
        const weather = createWeather({
          visibility: 2,
          ceiling: 1000,
          windSpeed: 15,
          conditions: ['Thunderstorm'],
        });

        const result = evaluateWaypoint(waypoint, weather, 'STUDENT_PILOT');

        expect(result.safe).toBe(false);
        expect(result.violations.length).toBeGreaterThanOrEqual(4);
      });
    });

    describe('PRIVATE_PILOT minimums', () => {
      it('passes with lower minimums than student', () => {
        const waypoint = createWaypoint();
        const weather = createWeather({
          visibility: 3,
          ceiling: 1000,
          windSpeed: 12,
        });

        const result = evaluateWaypoint(waypoint, weather, 'PRIVATE_PILOT');

        expect(result.safe).toBe(true);
      });

      it('still fails with prohibited conditions', () => {
        const waypoint = createWaypoint();
        const weather = createWeather({ conditions: ['Thunderstorm'] });

        const result = evaluateWaypoint(waypoint, weather, 'PRIVATE_PILOT');

        expect(result.safe).toBe(false);
      });
    });

    describe('INSTRUMENT_RATED minimums', () => {
      it('passes with very low minimums', () => {
        const waypoint = createWaypoint();
        const weather = createWeather({
          visibility: 1,
          ceiling: 500,
          windSpeed: 18,
        });

        const result = evaluateWaypoint(waypoint, weather, 'INSTRUMENT_RATED');

        expect(result.safe).toBe(true);
      });

      it('still fails with severe conditions', () => {
        const waypoint = createWaypoint();
        const weather = createWeather({ conditions: ['Severe Icing'] });

        const result = evaluateWaypoint(waypoint, weather, 'INSTRUMENT_RATED');

        expect(result.safe).toBe(false);
      });
    });
  });

  describe('evaluateRoute', () => {
    it('marks route as SAFE when all waypoints are safe', () => {
      const waypointsWithWeather: WaypointWeatherData[] = [
        { waypoint: createWaypoint(), weather: createWeather() },
        { waypoint: createWaypoint(), weather: createWeather() },
        { waypoint: createWaypoint(), weather: createWeather() },
      ];

      const result = evaluateRoute(waypointsWithWeather, 'STUDENT_PILOT');

      expect(result.safe).toBe(true);
      expect(result.overallStatus).toBe('SAFE');
      expect(result.violationSummary).toHaveLength(0);
    });

    it('marks route as UNSAFE when all waypoints are unsafe', () => {
      const unsafeWeather = createWeather({ visibility: 1 });
      const waypointsWithWeather: WaypointWeatherData[] = [
        { waypoint: createWaypoint(), weather: unsafeWeather },
        { waypoint: createWaypoint(), weather: unsafeWeather },
        { waypoint: createWaypoint(), weather: unsafeWeather },
      ];

      const result = evaluateRoute(waypointsWithWeather, 'STUDENT_PILOT');

      expect(result.safe).toBe(false);
      expect(result.overallStatus).toBe('UNSAFE');
      expect(result.violationSummary.length).toBeGreaterThan(0);
    });

    it('marks route as MARGINAL when some waypoints are unsafe', () => {
      const waypointsWithWeather: WaypointWeatherData[] = [
        { waypoint: createWaypoint(), weather: createWeather() },
        { waypoint: createWaypoint(), weather: createWeather({ visibility: 1 }) },
        { waypoint: createWaypoint(), weather: createWeather() },
        { waypoint: createWaypoint(), weather: createWeather() },
      ];

      const result = evaluateRoute(waypointsWithWeather, 'STUDENT_PILOT');

      expect(result.safe).toBe(false);
      expect(result.overallStatus).toBe('MARGINAL');
    });

    it('generates correct violation summary', () => {
      const waypointsWithWeather: WaypointWeatherData[] = [
        { waypoint: createWaypoint(), weather: createWeather({ visibility: 1 }) },
        { waypoint: createWaypoint(), weather: createWeather({ ceiling: 500 }) },
        { waypoint: createWaypoint(), weather: createWeather({ visibility: 2 }) },
      ];

      const result = evaluateRoute(waypointsWithWeather, 'STUDENT_PILOT');

      expect(result.violationSummary).toContain('VISIBILITY: 2 waypoints');
      expect(result.violationSummary).toContain('CEILING: 1 waypoint');
    });
  });

  describe('getViolationReasons', () => {
    it('returns empty array for safe route', () => {
      const waypointsWithWeather: WaypointWeatherData[] = [
        { waypoint: createWaypoint(), weather: createWeather() },
      ];

      const routeEvaluation = evaluateRoute(waypointsWithWeather, 'STUDENT_PILOT');
      const reasons = getViolationReasons(routeEvaluation);

      expect(reasons).toHaveLength(0);
    });

    it('returns detailed reasons for violations', () => {
      const waypointsWithWeather: WaypointWeatherData[] = [
        { waypoint: createWaypoint(), weather: createWeather({ visibility: 1 }) },
        { waypoint: createWaypoint(), weather: createWeather({ ceiling: 500 }) },
      ];

      const routeEvaluation = evaluateRoute(waypointsWithWeather, 'STUDENT_PILOT');
      const reasons = getViolationReasons(routeEvaluation);

      expect(reasons.length).toBeGreaterThan(0);
      expect(reasons[0]).toContain('Waypoint 1');
      expect(reasons[0]).toContain('Visibility');
    });

    it('deduplicates identical violations', () => {
      const waypointsWithWeather: WaypointWeatherData[] = [
        { waypoint: createWaypoint(), weather: createWeather({ visibility: 1 }) },
        { waypoint: createWaypoint(), weather: createWeather({ visibility: 1 }) },
      ];

      const routeEvaluation = evaluateRoute(waypointsWithWeather, 'STUDENT_PILOT');
      const reasons = getViolationReasons(routeEvaluation);

      // Should have 2 reasons (one per waypoint) even though violations are similar
      expect(reasons).toHaveLength(2);
    });
  });

  describe('meetsMinimums', () => {
    it('returns true for weather meeting minimums', () => {
      const weather = createWeather();
      expect(meetsMinimums(weather, 'STUDENT_PILOT')).toBe(true);
    });

    it('returns false for low visibility', () => {
      const weather = createWeather({ visibility: 1 });
      expect(meetsMinimums(weather, 'STUDENT_PILOT')).toBe(false);
    });

    it('returns false for low ceiling', () => {
      const weather = createWeather({ ceiling: 500 });
      expect(meetsMinimums(weather, 'STUDENT_PILOT')).toBe(false);
    });

    it('returns false for high winds', () => {
      const weather = createWeather({ windSpeed: 15 });
      expect(meetsMinimums(weather, 'STUDENT_PILOT')).toBe(false);
    });

    it('returns false for prohibited conditions', () => {
      const weather = createWeather({ conditions: ['Thunderstorm'] });
      expect(meetsMinimums(weather, 'STUDENT_PILOT')).toBe(false);
    });

    it('handles case-insensitive condition matching', () => {
      const weather = createWeather({ conditions: ['thunderstorm'] });
      expect(meetsMinimums(weather, 'STUDENT_PILOT')).toBe(false);
    });
  });
});
