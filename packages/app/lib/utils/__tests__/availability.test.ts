/**
 * Availability Utilities Tests
 * Unit tests for availability pattern handling
 */

import { describe, it, expect } from 'vitest';
import {
  getDayOfWeek,
  formatTimeSlot,
  timeToMinutes,
  isTimeInSlot,
  doSlotsOverlap,
  mergeTimeSlots,
  minutesToTime,
  getAvailabilityForDate,
  isAvailableAt,
  isValidTimeSlot,
  isValidWeeklySchedule,
  type TimeSlot,
  type InstructorAvailability,
} from '../availability';

describe('Availability Utilities', () => {
  describe('Time Conversion', () => {
    it('should convert time string to minutes', () => {
      expect(timeToMinutes('00:00')).toBe(0);
      expect(timeToMinutes('09:00')).toBe(540);
      expect(timeToMinutes('12:30')).toBe(750);
      expect(timeToMinutes('23:59')).toBe(1439);
    });

    it('should convert minutes to time string', () => {
      expect(minutesToTime(0)).toBe('00:00');
      expect(minutesToTime(540)).toBe('09:00');
      expect(minutesToTime(750)).toBe('12:30');
      expect(minutesToTime(1439)).toBe('23:59');
    });
  });

  describe('Time Slot Operations', () => {
    it('should detect if time is in slot', () => {
      const slot: TimeSlot = { start: '09:00', end: '17:00' };

      expect(isTimeInSlot('09:00', slot)).toBe(true);
      expect(isTimeInSlot('12:00', slot)).toBe(true);
      expect(isTimeInSlot('17:00', slot)).toBe(true);
      expect(isTimeInSlot('08:59', slot)).toBe(false);
      expect(isTimeInSlot('17:01', slot)).toBe(false);
    });

    it('should detect overlapping slots', () => {
      const slot1: TimeSlot = { start: '09:00', end: '12:00' };
      const slot2: TimeSlot = { start: '11:00', end: '14:00' };
      const slot3: TimeSlot = { start: '14:00', end: '17:00' };

      expect(doSlotsOverlap(slot1, slot2)).toBe(true);
      expect(doSlotsOverlap(slot2, slot3)).toBe(false);
      expect(doSlotsOverlap(slot1, slot3)).toBe(false);
    });

    it('should merge overlapping time slots', () => {
      const slots: TimeSlot[] = [
        { start: '09:00', end: '12:00' },
        { start: '11:00', end: '14:00' },
        { start: '16:00', end: '18:00' },
      ];

      const merged = mergeTimeSlots(slots);

      expect(merged).toHaveLength(2);
      expect(merged[0]).toEqual({ start: '09:00', end: '14:00' });
      expect(merged[1]).toEqual({ start: '16:00', end: '18:00' });
    });

    it('should format time slot correctly', () => {
      const slot: TimeSlot = { start: '09:00', end: '17:00' };
      const formatted = formatTimeSlot(slot);

      expect(formatted).toBe('9:00 AM - 5:00 PM');
    });
  });

  describe('Availability Checking', () => {
    const mockAvailability: InstructorAvailability = {
      weeklySchedule: {
        MON: [{ start: '09:00', end: '17:00' }],
        TUE: [{ start: '09:00', end: '17:00' }],
        WED: [{ start: '09:00', end: '17:00' }],
        THU: [{ start: '09:00', end: '17:00' }],
        FRI: [{ start: '09:00', end: '15:00' }],
      },
      exceptions: [
        {
          date: '2024-12-25',
          available: false,
          reason: 'Christmas Day',
        },
        {
          date: '2024-12-26',
          available: true,
          timeSlots: [{ start: '10:00', end: '14:00' }],
          reason: 'Special hours',
        },
      ],
    };

    it('should get availability for a regular weekday', () => {
      // Monday, Jan 1, 2024
      const monday = new Date('2024-01-01');

      const result = getAvailabilityForDate(monday, mockAvailability);

      expect(result.available).toBe(true);
      expect(result.slots).toHaveLength(1);
      expect(result.slots[0]).toEqual({ start: '09:00', end: '17:00' });
    });

    it('should get availability for a day off (exception)', () => {
      const christmas = new Date('2024-12-25');

      const result = getAvailabilityForDate(christmas, mockAvailability);

      expect(result.available).toBe(false);
      expect(result.reason).toBe('Christmas Day');
    });

    it('should get availability for day with custom hours (exception)', () => {
      const boxingDay = new Date('2024-12-26');

      const result = getAvailabilityForDate(boxingDay, mockAvailability);

      expect(result.available).toBe(true);
      expect(result.slots).toHaveLength(1);
      expect(result.slots[0]).toEqual({ start: '10:00', end: '14:00' });
    });

    it('should check availability at specific date/time', () => {
      // Monday at 10:00 AM, 2 hour duration
      const monday10am = new Date('2024-01-01T10:00:00');

      const result = isAvailableAt(monday10am, 120, mockAvailability);

      expect(result.available).toBe(true);
    });

    it('should reject booking outside available hours', () => {
      // Monday at 6:00 PM (after 5:00 PM close)
      const monday6pm = new Date('2024-01-01T18:00:00');

      const result = isAvailableAt(monday6pm, 60, mockAvailability);

      expect(result.available).toBe(false);
      expect(result.reason).toBeDefined();
    });
  });

  describe('Validation', () => {
    it('should validate correct time slot format', () => {
      expect(isValidTimeSlot({ start: '09:00', end: '17:00' })).toBe(true);
      expect(isValidTimeSlot({ start: '00:00', end: '23:59' })).toBe(true);
    });

    it('should reject invalid time slot format', () => {
      expect(isValidTimeSlot({ start: '9:00', end: '17:00' })).toBe(false); // Missing leading zero
      expect(isValidTimeSlot({ start: '09:00', end: '25:00' })).toBe(false); // Invalid hour
      expect(isValidTimeSlot({ start: '09:00', end: '09:60' })).toBe(false); // Invalid minute
      expect(isValidTimeSlot({ start: '17:00', end: '09:00' })).toBe(false); // End before start
    });

    it('should validate weekly schedule', () => {
      const validSchedule = {
        MON: [{ start: '09:00', end: '17:00' }],
        TUE: [{ start: '09:00', end: '17:00' }],
      };

      const invalidSchedule = {
        MON: [{ start: '09:00', end: '25:00' }], // Invalid hour
      };

      expect(isValidWeeklySchedule(validSchedule)).toBe(true);
      expect(isValidWeeklySchedule(invalidSchedule)).toBe(false);
    });
  });

  describe('Day of Week Helpers', () => {
    it('should get correct day of week key', () => {
      expect(getDayOfWeek(new Date('2024-01-01'))).toBe('MON'); // Monday
      expect(getDayOfWeek(new Date('2024-01-02'))).toBe('TUE'); // Tuesday
      expect(getDayOfWeek(new Date('2024-01-07'))).toBe('SUN'); // Sunday
    });
  });
});
