import { describe, it, expect } from 'vitest';
import {
  haversineDistance,
  intermediatePoint,
  generateGreatCircleWaypoints,
  generateLocalFlightWaypoints,
  calculateWaypoints,
  parseLocation,
} from '../waypoints';

describe('waypoints', () => {
  describe('haversineDistance', () => {
    it('calculates distance between two points correctly', () => {
      // New York to Los Angeles (approx 2125 NM)
      const distance = haversineDistance(40.7128, -74.006, 34.0522, -118.2437);
      expect(distance).toBeCloseTo(2125, 0); // within 1 NM
    });

    it('returns 0 for same location', () => {
      const distance = haversineDistance(40.7128, -74.006, 40.7128, -74.006);
      expect(distance).toBe(0);
    });

    it('handles negative coordinates', () => {
      const distance = haversineDistance(-33.8688, 151.2093, -37.8136, 144.9631);
      expect(distance).toBeGreaterThan(0);
    });
  });

  describe('intermediatePoint', () => {
    it('returns start point when fraction is 0', () => {
      const [lat, lon] = intermediatePoint(40.7128, -74.006, 34.0522, -118.2437, 0);
      expect(lat).toBeCloseTo(40.7128, 4);
      expect(lon).toBeCloseTo(-74.006, 4);
    });

    it('returns end point when fraction is 1', () => {
      const [lat, lon] = intermediatePoint(40.7128, -74.006, 34.0522, -118.2437, 1);
      expect(lat).toBeCloseTo(34.0522, 4);
      expect(lon).toBeCloseTo(-118.2437, 4);
    });

    it('returns midpoint when fraction is 0.5', () => {
      const [lat, lon] = intermediatePoint(40.7128, -74.006, 34.0522, -118.2437, 0.5);
      // Midpoint should be roughly in the middle
      expect(lat).toBeGreaterThan(34);
      expect(lat).toBeLessThan(41);
      expect(lon).toBeLessThan(-74);
      expect(lon).toBeGreaterThan(-119);
    });
  });

  describe('generateGreatCircleWaypoints', () => {
    it('generates correct number of waypoints for 60-minute flight', () => {
      const startTime = new Date('2025-01-01T10:00:00Z');
      const waypoints = generateGreatCircleWaypoints(
        40.7128,
        -74.006,
        34.0522,
        -118.2437,
        startTime,
        60
      );

      // 60 minutes / 30 minute intervals = 2 intervals + departure + arrival = 3 waypoints
      expect(waypoints.length).toBe(3);
      expect(waypoints[0].lat).toBe(40.7128);
      expect(waypoints[0].lon).toBe(-74.006);
      expect(waypoints[waypoints.length - 1].lat).toBe(34.0522);
      expect(waypoints[waypoints.length - 1].lon).toBe(-118.2437);
    });

    it('generates correct timestamps for waypoints', () => {
      const startTime = new Date('2025-01-01T10:00:00Z');
      const waypoints = generateGreatCircleWaypoints(
        40.7128,
        -74.006,
        34.0522,
        -118.2437,
        startTime,
        90
      );

      expect(waypoints[0].timestamp.getTime()).toBe(startTime.getTime());
      expect(waypoints[1].timestamp.getTime()).toBe(
        new Date('2025-01-01T10:30:00Z').getTime()
      );
      expect(waypoints[2].timestamp.getTime()).toBe(
        new Date('2025-01-01T11:00:00Z').getTime()
      );
      expect(waypoints[3].timestamp.getTime()).toBe(
        new Date('2025-01-01T11:30:00Z').getTime()
      );
    });

    it('handles short flights correctly', () => {
      const startTime = new Date('2025-01-01T10:00:00Z');
      const waypoints = generateGreatCircleWaypoints(
        40.7128,
        -74.006,
        40.7614,
        -73.9776,
        startTime,
        15
      );

      // 15 minutes < 30 minute interval = only departure and arrival
      expect(waypoints.length).toBe(2);
    });
  });

  describe('generateLocalFlightWaypoints', () => {
    it('generates waypoints in a circular pattern', () => {
      const startTime = new Date('2025-01-01T10:00:00Z');
      const waypoints = generateLocalFlightWaypoints(40.7128, -74.006, startTime, 60);

      // 60 minutes / 30 minute intervals + 1 = 3 waypoints
      expect(waypoints.length).toBe(3);

      // All waypoints should be roughly the same distance from center
      const distances = waypoints.map((wp) =>
        haversineDistance(40.7128, -74.006, wp.lat, wp.lon)
      );

      distances.forEach((distance) => {
        expect(distance).toBeCloseTo(25, 0); // Default radius is 25 NM
      });
    });

    it('respects custom radius', () => {
      const startTime = new Date('2025-01-01T10:00:00Z');
      const radius = 50;
      const waypoints = generateLocalFlightWaypoints(
        40.7128,
        -74.006,
        startTime,
        60,
        radius
      );

      const distances = waypoints.map((wp) =>
        haversineDistance(40.7128, -74.006, wp.lat, wp.lon)
      );

      distances.forEach((distance) => {
        expect(distance).toBeCloseTo(radius, 0);
      });
    });
  });

  describe('parseLocation', () => {
    it('parses valid coordinate string', () => {
      const result = parseLocation('40.7128,-74.0060');
      expect(result).toEqual([40.7128, -74.006]);
    });

    it('parses coordinates with spaces', () => {
      const result = parseLocation('40.7128, -74.0060');
      expect(result).toEqual([40.7128, -74.006]);
    });

    it('returns null for airport code', () => {
      const result = parseLocation('KJFK');
      expect(result).toBeNull();
    });

    it('validates latitude range', () => {
      const result = parseLocation('100.0,-74.0');
      expect(result).toBeNull();
    });

    it('validates longitude range', () => {
      const result = parseLocation('40.0,-200.0');
      expect(result).toBeNull();
    });
  });

  describe('calculateWaypoints', () => {
    it('uses great-circle route for distant locations', () => {
      const startTime = new Date('2025-01-01T10:00:00Z');
      const waypoints = calculateWaypoints(
        '40.7128,-74.0060',
        '34.0522,-118.2437',
        startTime,
        60
      );

      expect(waypoints.length).toBeGreaterThan(0);
      expect(waypoints[0].lat).toBeCloseTo(40.7128, 4);
    });

    it('uses local flight pattern for close locations', () => {
      const startTime = new Date('2025-01-01T10:00:00Z');
      const waypoints = calculateWaypoints(
        '40.7128,-74.0060',
        '40.7128,-74.0060',
        startTime,
        60
      );

      // Should generate circular pattern
      expect(waypoints.length).toBeGreaterThan(2);

      // Check that waypoints form a pattern around center
      const distances = waypoints.map((wp) =>
        haversineDistance(40.7128, -74.006, wp.lat, wp.lon)
      );

      // All should be roughly the same distance from center
      const avgDistance = distances.reduce((a, b) => a + b, 0) / distances.length;
      distances.forEach((d) => {
        expect(Math.abs(d - avgDistance)).toBeLessThan(5); // Within 5 NM
      });
    });

    it('throws error for airport codes', () => {
      const startTime = new Date('2025-01-01T10:00:00Z');
      expect(() => {
        calculateWaypoints('KJFK', 'KLAX', startTime, 60);
      }).toThrow('Airport code lookup not implemented');
    });
  });
});
