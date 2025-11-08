/**
 * Redis Client
 * Singleton Redis client for pub/sub and caching
 */

import { createClient, type RedisClientType } from 'redis';

let redisClient: RedisClientType | null = null;
let pubClient: RedisClientType | null = null;
let subClient: RedisClientType | null = null;

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

/**
 * Get or create the main Redis client
 */
export async function getRedisClient(): Promise<RedisClientType> {
  if (!redisClient) {
    redisClient = createClient({
      url: REDIS_URL,
    }) as RedisClientType;

    redisClient.on('error', (err) => {
      console.error('Redis Client Error:', err);
    });

    redisClient.on('connect', () => {
      console.log('Redis Client Connected');
    });

    await redisClient.connect();
  }

  return redisClient;
}

/**
 * Get or create the Redis publisher client
 */
export async function getRedisPubClient(): Promise<RedisClientType> {
  if (!pubClient) {
    pubClient = createClient({
      url: REDIS_URL,
    }) as RedisClientType;

    pubClient.on('error', (err) => {
      console.error('Redis Pub Client Error:', err);
    });

    await pubClient.connect();
  }

  return pubClient;
}

/**
 * Get or create the Redis subscriber client
 */
export async function getRedisSubClient(): Promise<RedisClientType> {
  if (!subClient) {
    subClient = createClient({
      url: REDIS_URL,
    }) as RedisClientType;

    subClient.on('error', (err) => {
      console.error('Redis Sub Client Error:', err);
    });

    await subClient.connect();
  }

  return subClient;
}

/**
 * Close all Redis connections
 */
export async function closeRedisConnections() {
  const clients = [redisClient, pubClient, subClient].filter(Boolean);

  await Promise.all(clients.map((client) => client?.quit()));

  redisClient = null;
  pubClient = null;
  subClient = null;
}
