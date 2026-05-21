// ============================================================
// app/lib/cron-auth.ts
//
// Cron HMAC verification — timing-safe secret check, IP allowlist,
// and replay-prevention window for internal cron-triggered requests.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'

/**
 * Timing-safe comparison of cron secret header vs env secret.
 * Pads both buffers to same length before compare to avoid leaking
 * secret length via timing (early return on length mismatch is a side-channel).
 */
export function isCronRequest(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET
  const cronHeader = request.headers.get('x-cron-secret')
  if (!cronSecret || !cronHeader) return false
  try {
    const maxLen = Math.max(cronSecret.length, cronHeader.length)
    const a = Buffer.alloc(maxLen)
    const b = Buffer.alloc(maxLen)
    Buffer.from(cronSecret).copy(a)
    Buffer.from(cronHeader).copy(b)
    return require('crypto').timingSafeEqual(a, b)
  } catch { return false }
}

/**
 * Verifies an incoming cron request: timing-safe secret, optional IP
 * allowlist, and a 5-minute replay-prevention window.
 *
 * Returns null when the request is a valid cron call (caller should proceed),
 * or a NextResponse with the appropriate error when invalid.
 *
 * Returns `{ isCron: false }` when this is NOT a cron request — caller should
 * fall back to normal session/CSRF auth.
 */
export function verifyCronRequest(
  request: NextRequest,
): { isCron: true; error: NextResponse | null } | { isCron: false } {
  if (!isCronRequest(request)) return { isCron: false }

  // H3: if cron secret matches, also verify the caller IP is in the allowlist
  const allowedIps = (process.env.CRON_ALLOWED_IPS ?? '').split(',').map(s => s.trim()).filter(Boolean)
  if (allowedIps.length > 0) {
    const callerIp =
      request.headers.get('x-real-ip') ||
      request.headers.get('x-forwarded-for')?.split(',').at(0)?.trim() ||
      ''
    if (!allowedIps.includes(callerIp)) {
      return { isCron: true, error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
    }
  }

  // Replay-prevention: cron caller must include a fresh x-cron-ts timestamp
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
