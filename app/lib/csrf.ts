import { NextRequest, NextResponse } from 'next/server'

// CSRF protection: three-layer check.
// 1. X-Requested-With: XMLHttpRequest — browsers cannot set custom headers cross-site
//    without a CORS preflight, which the server does not allow.
// 2. Origin/Referer header — must be present and must match the app's own host.
//    Requests with neither header are rejected (prevents script-based attacks from
//    clients that strip both headers, e.g. curl/Postman without X-Requested-With).
// 3. Host match — origin/referer host must equal the request host.

export function checkCsrf(request: NextRequest): NextResponse | null {
  const xrw = request.headers.get('x-requested-with')
  if (xrw?.toLowerCase() !== 'xmlhttprequest') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const host    = request.headers.get('host')
  const origin  = request.headers.get('origin')
  const referer = request.headers.get('referer')

  // Reject if neither Origin nor Referer is present — cannot verify request source
  if (!origin && !referer) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (origin) {
    try {
      const originHost = new URL(origin).host
      if (host && originHost !== host) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    } catch {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  } else if (referer) {
    try {
      const refererHost = new URL(referer).host
      if (host && refererHost !== host) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    } catch {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  return null
}
