import { NextRequest } from 'next/server'

/**
 * Returns the trusted client IP.
 * On Vercel, x-real-ip is set by the edge network and cannot be spoofed.
 * x-forwarded-for[0] is attacker-controlled and must not be used for security decisions.
 */
export function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-real-ip') ||
    request.headers.get('x-forwarded-for')?.split(',').at(0)?.trim() ||
    'unknown'
  )
}
