/**
 * A counter that survives more than one API process.
 *
 * Every other limiter in this codebase is `express-rate-limit`'s default
 * in-memory store, which counts per process. That is fine for a login form,
 * where the protection is against a human with a script. It is not fine for
 * a partner's contractual rate limit: the moment there are two instances
 * behind the load balancer, a partner on 60 a minute quietly gets 120, and
 * the number in their contract stops meaning anything.
 *
 * Written here rather than pulled from `rate-limit-redis` for the same reason
 * the ICS builder and the SNS signature check are hand-written: it is thirty
 * lines, it sits in the path of a public endpoint, and the dependency would
 * have to be understood before it could be trusted anyway.
 *
 * Fixed window rather than sliding: a partner can in theory get 2x their limit
 * across a window boundary. That is the standard trade and it is the right one
 * here, because the limit exists to stop a runaway integration, not to police
 * a burst to the exact request.
 */
import { redis, isRedisAvailable } from './redis';
import { logger } from '../logger';

export interface RateVerdict {
  allowed: boolean;
  limit: number;
  remaining: number;
  /** Seconds until the window resets, for the Retry-After header. */
  resetSeconds: number;
}

/**
 * In-memory fallback, used only when Redis is unavailable.
 *
 * Deliberately still counts rather than waving everything through. Losing
 * Redis should degrade the limit to per-process, not remove it: an unlimited
 * endpoint is a worse failure than a generous one.
 */
const localCounters = new Map<string, { count: number; expiresAt: number }>();

function countLocally(key: string, limit: number, windowSeconds: number): RateVerdict {
  const now = Date.now();
  const existing = localCounters.get(key);

  if (!existing || existing.expiresAt <= now) {
    localCounters.set(key, { count: 1, expiresAt: now + windowSeconds * 1000 });
    return { allowed: true, limit, remaining: limit - 1, resetSeconds: windowSeconds };
  }

  existing.count += 1;
  const resetSeconds = Math.max(1, Math.ceil((existing.expiresAt - now) / 1000));
  return {
    allowed: existing.count <= limit,
    limit,
    remaining: Math.max(0, limit - existing.count),
    resetSeconds,
  };
}

/** Stops the fallback map growing without bound on a long-lived process. */
function sweepLocalCounters(): void {
  const now = Date.now();
  for (const [key, value] of localCounters) {
    if (value.expiresAt <= now) localCounters.delete(key);
  }
}

setInterval(sweepLocalCounters, 60_000).unref();

export async function consume(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<RateVerdict> {
  if (!isRedisAvailable()) return countLocally(key, limit, windowSeconds);

  try {
    // INCR then EXPIRE only on the first hit, so the window is anchored to the
    // first request rather than sliding forward on every one, which would let
    // a steady caller hold a window open indefinitely.
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, windowSeconds);

    const ttl = await redis.ttl(key);
    // -1 means the key exists with no expiry, which can only happen if the
    // EXPIRE above was lost. Repair it rather than leaking a permanent counter.
    if (ttl < 0) await redis.expire(key, windowSeconds);

    return {
      allowed: count <= limit,
      limit,
      remaining: Math.max(0, limit - count),
      resetSeconds: ttl > 0 ? ttl : windowSeconds,
    };
  } catch (error) {
    logger.warn(
      { err: error instanceof Error ? error.message : error, key },
      'Rate limit counter failed, falling back to in-process counting'
    );
    return countLocally(key, limit, windowSeconds);
  }
}
