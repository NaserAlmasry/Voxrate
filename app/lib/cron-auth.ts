// ============================================================
// app/lib/cron-auth.ts
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'

function safeCompare(a: string, b: string): boolean {
  const maxLen = Math.max(a.length, b.length)
  const bufA = Buffer.alloc(maxLen)
  const bufB = Buffer.alloc(maxLen)
  Buffer.from(a).copy(bufA)
  Buffer.from(b).copy(bufB)
  return timingSafeEqual(bufA, bufB) && a.length === b.length
}

export function isCronRequest(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET
  const cronHeader = request.headers.get('x-cron-secret')
  if (!cronSecret || !cronHeader) return false
  return safeCompare(cronSecret, cronHeader)
}

export function verifyCronRequest(
  request: NextRequest,
): { isCron: true; error: NextResponse | null } | { isCron: false } {
  if (!isCronRequest(request)) return { isCron: false }

  const allowedIps = (process.env.CRON_ALLOWED_IPS ?? '').split(',').map(s => s.trim()).filter(Boolean)
  if (allowedIps.length === 0) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[CronAuth] SECURITY: CRON_ALLOWED_IPS not set — rejecting request')
      return { isCron: true, error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
    }
    console.warn('[CronAuth] CRON_ALLOWED_IPS not set — skipping IP check (dev mode)')
  }
  if (allowedIps.length > 0) {
    const callerIp =
      request.headers.get('x-real-ip') ||
      request.headers.get('x-forwarded-for')?.split(',').at(0)?.trim() ||
      ''
    if (!allowedIps.includes(callerIp)) {
      return { isCron: true, error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
    }
  }

  const cronTs = request.headers.get('x-cron-ts')
  if (!cronTs) {
    return { isCron: true, error: NextResponse.json({ error: 'Missing x-cron-ts header' }, { status: 401 }) }
  }
  const tsAge = Date.now() - parseInt(cronTs, 10)
  if (!Number.isFinite(tsAge) || tsAge > 5 * 60 * 1000) {
    return { isCron: true, error: NextResponse.json({ error: 'Cron token expired' }, { status: 401 }) }
  }

  return { isCron: true, error: null }
}

// Used by Vercel-scheduled cron routes (Authorization: Bearer pattern)
export function verifyCronBearer(request: NextRequest): NextResponse | null {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const authHeader = request.headers.get('authorization') || ''
  if (!safeCompare(`Bearer ${cronSecret}`, authHeader)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const allowedIps = (process.env.CRON_ALLOWED_IPS ?? '').split(',').map(s => s.trim()).filter(Boolean)
  if (allowedIps.length === 0 && process.env.NODE_ENV === 'production') {
    console.warn('[CronAuth] CRON_ALLOWED_IPS not set in production — IP check skipped')
  }
  if (allowedIps.length > 0) {
    const callerIp =
      request.headers.get('x-real-ip') ||
      request.headers.get('x-forwarded-for')?.split(',').at(0)?.trim() ||
      ''
    if (!allowedIps.includes(callerIp)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  return null
}
