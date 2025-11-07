import { z } from 'zod';

export const TrainingLevelSchema = z.enum(['STUDENT_PILOT', 'PRIVATE_PILOT', 'INSTRUMENT_RATED']);
export type TrainingLevel = z.infer<typeof TrainingLevelSchema>;

export const WeatherConditionSchema = z.object({
  visibility: z.number(), // in miles
  ceiling: z.number(), // in feet
  windSpeed: z.number(), // in knots
  windGust: z.number().optional(), // in knots
  conditions: z.array(z.string()), // e.g., ['Thunderstorm', 'Rain']
});
export type WeatherCondition = z.infer<typeof WeatherConditionSchema>;

export const WaypointSchema = z.object({
  lat: z.number(),
  lon: z.number(),
  timestamp: z.date(),
});
export type Waypoint = z.infer<typeof WaypointSchema>;

export const WeatherMinimumSchema = z.object({
  visibility: z.number(),
  ceiling: z.number(),
  windSpeed: z.number(),
  windGust: z.number(),
  prohibitedConditions: z.array(z.string()),
});
export type WeatherMinimum = z.infer<typeof WeatherMinimumSchema>;
