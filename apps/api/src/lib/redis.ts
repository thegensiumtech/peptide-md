import Redis from 'ioredis';
import { config } from '../config';
import { logger } from '../logger';

/**
 * Redis carries the fast path for slot holds and rate limiting.
 *
 * It is deliberately not the source of truth: the unique constraint on
 * slot_holds in Postgres is what actually guarantees one winner. Redis makes
 * the common case cheap; Postgres makes the contended case correct. If Redis
 * is down the platform still books correctly, just with more database work.
 */
export const redis = new Redis(config.REDIS_URL, {
  maxRetriesPerRequest: 2,
  lazyConnect: true,
  retryStrategy: (times) => Math.min(times * 200, 2000),
});

let available = false;

redis.on('ready', () => {
  available = true;
  logger.info('Redis connected');
});

redis.on('error', (error) => {
  if (available) logger.warn({ err: error.message }, 'Redis unavailable, falling back to Postgres');
  available = false;
});

export const isRedisAvailable = () => available;

export async function connectRedis(): Promise<void> {
  try {
    await redis.connect();
  } catch (error) {
    logger.warn(
      { err: error instanceof Error ? error.message : error },
      'Redis unreachable at boot, continuing without the cache layer'
    );
  }
}

/** Best-effort helpers: a Redis failure must never fail a booking. */
export async function cacheGet(key: string): Promise<string | null> {
  if (!available) return null;
  try {
    return await redis.get(key);
  } catch {
    return null;
  }
}

export async function cacheSet(key: string, value: string, ttlSeconds: number): Promise<void> {
  if (!available) return;
  try {
    await redis.set(key, value, 'EX', ttlSeconds);
  } catch {
    // Cache writes are optional by definition.
  }
}

export async function cacheDelete(pattern: string): Promise<void> {
  if (!available) return;
  try {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) await redis.del(...keys);
  } catch {
    // Nothing to do, the entry will expire on its own.
  }
}
