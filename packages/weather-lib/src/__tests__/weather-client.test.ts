import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WeatherClient, createWeatherClient } from '../weather-client';

// Mock fetch
global.fetch = vi.fn();

describe('WeatherClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockWeatherResponse = {
    visibility: 16093, // ~10 miles in meters
    clouds: { all: 20 },
    weather: [{ main: 'Clear', description: 'clear sky' }],
    wind: { speed: 4.12, gust: 6.17 }, // ~8 knots and ~12 knots
    dt: 1704110400,
  };

  describe('constructor', () => {
    it('creates client with default options', () => {
      const client = new WeatherClient({
        apiKey: 'test-key',
      });

      expect(client).toBeDefined();
    });

    it('creates client with custom options', () => {
      const client = new WeatherClient({
        apiKey: 'test-key',
        cacheEnabled: false,
        cacheTTLSeconds: 300,
        rateLimitPerMinute: 30,
      });

      expect(client).toBeDefined();
    });
  });

  describe('getWeather', () => {
    it('fetches weather from API successfully', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockWeatherResponse,
      } as Response);

      const client = new WeatherClient({
        apiKey: 'test-key',
        cacheEnabled: false,
      });

      const weather = await client.getWeather(40.7128, -74.006);

      expect(weather.visibility).toBeCloseTo(10, 0);
      expect(weather.ceiling).toBe(10000); // Few clouds estimate
      expect(weather.windSpeed).toBeCloseTo(8, 0);
      expect(weather.windGust).toBeCloseTo(12, 0);
      expect(weather.conditions).toEqual(['Clear']);
    });

    it('includes API key in request', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockWeatherResponse,
      } as Response);

      const client = new WeatherClient({
        apiKey: 'test-api-key',
        cacheEnabled: false,
      });

      await client.getWeather(40.7128, -74.006);

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('appid=test-api-key')
      );
    });

    it('includes coordinates in request', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockWeatherResponse,
      } as Response);

      const client = new WeatherClient({
        apiKey: 'test-key',
        cacheEnabled: false,
      });

      await client.getWeather(40.7128, -74.006);

      const callUrl = (fetch as any).mock.calls[0][0];
      expect(callUrl).toContain('lat=40.7128');
      expect(callUrl).toContain('lon=-74.006');
    });

    it('throws error for invalid API key', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      } as Response);

      const client = new WeatherClient({
        apiKey: 'invalid-key',
        cacheEnabled: false,
      });

      await expect(client.getWeather(40.7128, -74.006)).rejects.toThrow(
        'Invalid OpenWeatherMap API key'
      );
    });

    it('throws error for rate limit exceeded', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
      } as Response);

      const client = new WeatherClient({
        apiKey: 'test-key',
        cacheEnabled: false,
      });

      await expect(client.getWeather(40.7128, -74.006)).rejects.toThrow(
        'OpenWeatherMap API rate limit exceeded'
      );
    });

    it('throws error for other API errors', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      } as Response);

      const client = new WeatherClient({
        apiKey: 'test-key',
        cacheEnabled: false,
      });

      await expect(client.getWeather(40.7128, -74.006)).rejects.toThrow(
        'OpenWeatherMap API error'
      );
    });
  });

  describe('caching', () => {
    it('caches weather data', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => mockWeatherResponse,
      } as Response);

      const client = new WeatherClient({
        apiKey: 'test-key',
        cacheEnabled: true,
        cacheTTLSeconds: 600,
      });

      // First call
      await client.getWeather(40.7128, -74.006);

      // Second call - should use cache
      await client.getWeather(40.7128, -74.006);

      // Fetch should only be called once
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('returns cached data', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockWeatherResponse,
      } as Response);

      const client = new WeatherClient({
        apiKey: 'test-key',
        cacheEnabled: true,
      });

      const weather1 = await client.getWeather(40.7128, -74.006);
      const weather2 = await client.getWeather(40.7128, -74.006);

      expect(weather1).toEqual(weather2);
    });

    it('respects cache disable option', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => mockWeatherResponse,
      } as Response);

      const client = new WeatherClient({
        apiKey: 'test-key',
        cacheEnabled: false,
      });

      await client.getWeather(40.7128, -74.006);
      await client.getWeather(40.7128, -74.006);

      // Should call fetch twice when cache disabled
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('clears cache on demand', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => mockWeatherResponse,
      } as Response);

      const client = new WeatherClient({
        apiKey: 'test-key',
        cacheEnabled: true,
      });

      await client.getWeather(40.7128, -74.006);
      client.clearCache();
      await client.getWeather(40.7128, -74.006);

      // Should call fetch twice after cache clear
      expect(fetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('rate limiting', () => {
    it('enforces rate limit', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => mockWeatherResponse,
      } as Response);

      const client = new WeatherClient({
        apiKey: 'test-key',
        cacheEnabled: false,
        rateLimitPerMinute: 2, // Very low limit for testing
      });

      // First two should succeed
      await client.getWeather(40.7128, -74.006);
      await client.getWeather(40.7129, -74.007);

      // Third should fail due to rate limit
      await expect(client.getWeather(40.713, -74.008)).rejects.toThrow(
        'Rate limit exceeded'
      );
    });
  });

  describe('getWeatherForWaypoints', () => {
    it('fetches weather for multiple waypoints', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => mockWeatherResponse,
      } as Response);

      const client = new WeatherClient({
        apiKey: 'test-key',
        cacheEnabled: false,
        rateLimitPerMinute: 100,
      });

      const waypoints = [
        { lat: 40.7128, lon: -74.006, timestamp: new Date() },
        { lat: 40.7614, lon: -73.9776, timestamp: new Date() },
      ];

      const weatherData = await client.getWeatherForWaypoints(waypoints);

      expect(weatherData).toHaveLength(2);
      expect(fetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('getCacheStats', () => {
    it('returns cache statistics', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => mockWeatherResponse,
      } as Response);

      const client = new WeatherClient({
        apiKey: 'test-key',
        cacheEnabled: true,
      });

      const initialStats = client.getCacheStats();
      expect(initialStats.size).toBe(0);

      await client.getWeather(40.7128, -74.006);

      const updatedStats = client.getCacheStats();
      expect(updatedStats.size).toBe(1);
    });
  });

  describe('createWeatherClient', () => {
    it('creates client with provided API key', () => {
      const client = createWeatherClient('test-key');
      expect(client).toBeDefined();
    });

    it('creates client with environment variable', () => {
      process.env.OPENWEATHERMAP_API_KEY = 'env-test-key';
      const client = createWeatherClient();
      expect(client).toBeDefined();
      delete process.env.OPENWEATHERMAP_API_KEY;
    });

    it('throws error when no API key provided', () => {
      delete process.env.OPENWEATHERMAP_API_KEY;
      expect(() => createWeatherClient()).toThrow('OpenWeatherMap API key is required');
    });
  });
});
