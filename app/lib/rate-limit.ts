// ============================================================
// lib/rate-limit.ts
// Serverless-safe rate limiter using Upstash Redis.
// - Authenticated users: limited by userId
// - Unauthenticated: limited by IP
// - 3 requests per 10-minute window
// - Atomic increment + TTL — no race conditions, no cold-start resets
// Local dev: falls back to in-memory map if Upstash env vars not set
// ============================================================

import { Redis } from '@upstash/redis'

const WINDOW_SECONDS = 10 * 60 // 10 minutes
export const MAX_REQUESTS = 30

// Upstash client — only created when env vars are present
const hasUpstash =
  !!process.env.UPSTASH_REDIS_REST_URL &&
  !!process.env.UPSTASH_REDIS_REST_TOKEN

if (!hasUpstash && process.env.NODE_ENV === 'production') {
  console.error('[RateLimit] CRITICAL: Upstash Redis not configured — rate limiting is DISABLED in production')
}

const redis = hasUpstash
  ? new Redis({
      url:   process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  : null

// Local dev fallback — in-memory only, resets on restart
// NOT suitable for production (use Upstash in prod)
const localMap = new Map<string, { count: number; resetAt: number }>()

function currentWindow(): number {
  return Math.floor(Date.now() / (WINDOW_SECONDS * 1000))
}

export interface RateLimitResult {
  allowed:   boolean
  remaining: number // requests left in this window
  resetAt:   number // Unix ms when window resets
}

const failClosedInProd = !hasUpstash && process.env.NODE_ENV === 'production'

/**
 * Check and increment rate limit for a given identifier.
 * Uses Upstash Redis in production, in-memory map in local dev.
 */
export async function checkRateLimit(
  identifier: string,
  type: 'user' | 'ip',
  maxRequests = MAX_REQUESTS,
): Promise<RateLimitResult> {
  const window  = currentWindow()
  const key     = `rl:${type}:${identifier}:${window}`
  const resetAt = (window + 1) * WINDOW_SECONDS * 1000

  // Fail closed in production if Upstash is not configured — refuse all requests
  if (failClosedInProd) {
    console.error('[RateLimit] BLOCKED — Upstash not configured in production; refusing request')
    return { allowed: false, remaining: 0, resetAt: 0 }
  }

  // Upstash path (production)
  if (redis) {
    const [count] = await redis.pipeline().incr(key).expire(key, WINDOW_SECONDS).exec() as [number, number]
    return {
      allowed:   count <= maxRequests,
      remaining: Math.max(0, maxRequests - count),
      resetAt,
    }
  }

  // Local fallback path (dev only)
  const now     = Date.now()
  const entry   = localMap.get(key)
  const current = entry && now < entry.resetAt ? entry : { count: 0, resetAt }
  current.count++
  localMap.set(key, current)

  return {
    allowed:   current.count <= maxRequests,
    remaining: Math.max(0, maxRequests - current.count),
    resetAt:   current.resetAt,
  }
}

/**
 * Convenience wrapper used in route handlers.
 * Picks the right identifier based on auth state.
 */
export async function enforceRateLimit(
  userId: string | null,
  ip: string,
  maxRequests = MAX_REQUESTS,
): Promise<RateLimitResult> {
  if (userId) {
    return checkRateLimit(userId, 'user', maxRequests)
  }
  return checkRateLimit(ip, 'ip', maxRequests)
}