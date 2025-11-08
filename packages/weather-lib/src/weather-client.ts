import type { WeatherCondition } from './types';

export interface OpenWeatherMapResponse {
  visibility: number; // in meters
  clouds: {
    all: number; // cloud coverage percentage
  };
  weather: Array<{
    main: string;
    description: string;
  }>;
  wind: {
    speed: number; // meters per second
    gust?: number; // meters per second
  };
  dt: number; // timestamp
}

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

export interface WeatherClientOptions {
  apiKey: string;
  cacheEnabled?: boolean;
  cacheTTLSeconds?: number;
  rateLimitPerMinute?: number;
}

/**
 * Convert meters to statute miles
 */
function metersToMiles(meters: number): number {
  return meters * 0.000621371;
}

/**
 * Convert meters per second to knots
 */
function mpsToKnots(mps: number): number {
  return mps * 1.94384;
}

/**
 * Estimate ceiling from cloud coverage
 * This is a simplified estimation - actual ceiling data requires paid OWM API tier
 */
function estimateCeiling(cloudCoverage: number): number {
  // Simple heuristic based on cloud coverage
  if (cloudCoverage === 0) return 25000; // Clear skies
  if (cloudCoverage < 25) return 10000; // Few clouds
  if (cloudCoverage < 50) return 5000; // Scattered
  if (cloudCoverage < 75) return 3000; // Broken
  return 1000; // Overcast
}

/**
 * In-memory cache implementation
 */
class MemoryCache {
  private cache = new Map<string, CacheEntry<WeatherCondition>>();

  get(key: string): WeatherCondition | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = Date.now();
    if (now > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  set(key: string, data: WeatherCondition, ttlSeconds: number): void {
    const now = Date.now();
    this.cache.set(key, {
      data,
      timestamp: now,
      expiresAt: now + ttlSeconds * 1000,
    });
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

/**
 * Rate limiter implementation using token bucket algorithm
 */
class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private readonly maxTokens: number;
  private readonly refillRate: number; // tokens per millisecond

  constructor(requestsPerMinute: number) {
    this.maxTokens = requestsPerMinute;
    this.tokens = requestsPerMinute;
    this.lastRefill = Date.now();
    this.refillRate = requestsPerMinute / 60000; // convert to per millisecond
  }

  /**
   * Refill tokens based on elapsed time
   */
  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    const tokensToAdd = elapsed * this.refillRate;

    this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }

  /**
   * Attempt to consume a token
   * @returns true if token was consumed, false if rate limit exceeded
   */
  tryConsume(): boolean {
    this.refill();

    if (this.tokens >= 1) {
      this.tokens -= 1;
      return true;
    }

    return false;
  }

  /**
   * Get time until next token is available (in milliseconds)
   */
  getTimeUntilNextToken(): number {
    this.refill();
    if (this.tokens >= 1) return 0;

    const tokensNeeded = 1 - this.tokens;
    return Math.ceil(tokensNeeded / this.refillRate);
  }
}

/**
 * OpenWeatherMap API client with caching and rate limiting
 */
export class WeatherClient {
  private apiKey: string;
  private cache: MemoryCache;
  private rateLimiter: RateLimiter;
  private cacheEnabled: boolean;
  private cacheTTL: number;
  private baseURL = 'https://api.openweathermap.org/data/2.5';

  constructor(options: WeatherClientOptions) {
    this.apiKey = options.apiKey;
    this.cacheEnabled = options.cacheEnabled ?? true;
    this.cacheTTL = options.cacheTTLSeconds ?? 600; // 10 minutes default
    this.cache = new MemoryCache();
    this.rateLimiter = new RateLimiter(options.rateLimitPerMinute ?? 60);
  }

  /**
   * Generate cache key for a weather request
   */
  private getCacheKey(lat: number, lon: number, timestamp: Date): string {
    // Round to nearest 10 minutes for better cache hits
    const roundedTime = Math.floor(timestamp.getTime() / (10 * 60 * 1000));
    return `${lat.toFixed(4)},${lon.toFixed(4)},${roundedTime}`;
  }

  /**
   * Parse OpenWeatherMap API response into WeatherCondition
   */
  private parseResponse(response: OpenWeatherMapResponse): WeatherCondition {
    // Convert visibility from meters to statute miles
    const visibilityMiles = metersToMiles(response.visibility);

    // Estimate ceiling from cloud coverage
    const ceiling = estimateCeiling(response.clouds.all);

    // Convert wind from m/s to knots
    const windSpeed = mpsToKnots(response.wind.speed);
    const windGust = response.wind.gust ? mpsToKnots(response.wind.gust) : undefined;

    // Extract weather conditions
    const conditions = response.weather.map((w) => w.main);

    return {
      visibility: visibilityMiles,
      ceiling,
      windSpeed,
      windGust,
      conditions,
    };
  }

  /**
   * Fetch current weather for a location
   * @param lat - Latitude
   * @param lon - Longitude
   * @param timestamp - Time for the weather check (used for caching)
   * @returns Weather conditions
   */
  async getWeather(lat: number, lon: number, timestamp: Date = new Date()): Promise<WeatherCondition> {
    // Check cache first
    const cacheKey = this.getCacheKey(lat, lon, timestamp);
    if (this.cacheEnabled) {
      const cached = this.cache.get(cacheKey);
      if (cached) {
        return cached;
      }
    }

    // Check rate limit
    if (!this.rateLimiter.tryConsume()) {
      const waitTime = this.rateLimiter.getTimeUntilNextToken();
      throw new Error(
        `Rate limit exceeded. Please wait ${Math.ceil(waitTime / 1000)} seconds before retrying.`
      );
    }

    // Fetch from API
    const url = new URL(`${this.baseURL}/weather`);
    url.searchParams.set('lat', lat.toString());
    url.searchParams.set('lon', lon.toString());
    url.searchParams.set('appid', this.apiKey);

    try {
      const response = await fetch(url.toString());

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Invalid OpenWeatherMap API key');
        }
        if (response.status === 429) {
          throw new Error('OpenWeatherMap API rate limit exceeded');
        }
        throw new Error(`OpenWeatherMap API error: ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as OpenWeatherMapResponse;
      const weather = this.parseResponse(data);

      // Cache the result
      if (this.cacheEnabled) {
        this.cache.set(cacheKey, weather, this.cacheTTL);
      }

      return weather;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to fetch weather data');
    }
  }

  /**
   * Fetch weather for multiple waypoints with batching
   * @param waypoints - Array of {lat, lon, timestamp} objects
   * @returns Array of weather conditions
   */
  async getWeatherForWaypoints(
    waypoints: Array<{ lat: number; lon: number; timestamp: Date }>
  ): Promise<WeatherCondition[]> {
    const results: WeatherCondition[] = [];

    for (const waypoint of waypoints) {
      const weather = await this.getWeather(waypoint.lat, waypoint.lon, waypoint.timestamp);
      results.push(weather);

      // Small delay between requests to avoid overwhelming the API
      // This is in addition to rate limiting
      if (waypoints.length > 1) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    return results;
  }

  /**
   * Clear the cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number } {
    return {
      size: this.cache.size(),
    };
  }
}

/**
 * Factory function to create a weather client with environment-based configuration
 */
export function createWeatherClient(apiKey?: string): WeatherClient {
  const key = apiKey || process.env.OPENWEATHERMAP_API_KEY;

  if (!key) {
    throw new Error(
      'OpenWeatherMap API key is required. Set OPENWEATHERMAP_API_KEY environment variable or pass apiKey parameter.'
    );
  }

  return new WeatherClient({
    apiKey: key,
    cacheEnabled: true,
    cacheTTLSeconds: 600, // 10 minutes
    rateLimitPerMinute: 60, // Free tier allows 60 calls/minute
  });
}
