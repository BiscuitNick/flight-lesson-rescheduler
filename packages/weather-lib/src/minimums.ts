import type { TrainingLevel, WeatherMinimum } from './types';

// Weather minimums by training level (from PRD)
export const WEATHER_MINIMUMS: Record<TrainingLevel, WeatherMinimum> = {
  STUDENT_PILOT: {
    visibility: 5,
    ceiling: 3000,
    windSpeed: 10,
    windGust: 15,
    prohibitedConditions: ['Thunderstorm', 'Freezing', 'Ice', 'Snow', 'Fog'],
  },
  PRIVATE_PILOT: {
    visibility: 3,
    ceiling: 1000,
    windSpeed: 15,
    windGust: 20,
    prohibitedConditions: ['Thunderstorm', 'Freezing', 'Ice'],
  },
  INSTRUMENT_RATED: {
    visibility: 0.5,
    ceiling: 200,
    windSpeed: 20,
    windGust: 30,
    prohibitedConditions: ['Thunderstorm', 'Severe Icing', 'Tornado'],
  },
};
