import { NextRequest, NextResponse } from 'next/server'

// CSRF protection: two-layer check.
// 1. X-Requested-With: XMLHttpRequest — browsers cannot set custom headers cross-site
//    without a CORS preflight, which the server does not allow.
// 2. Origin/Referer header — must match the app's own host when present.
//    Some browsers omit Origin on same-site requests, so we fall back to Referer.

export function checkCsrf(request: NextRequest): NextResponse | null {
  const xrw = request.headers.get('x-requested-with')
  if (xrw !== 'XMLHttpRequest') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const host   = request.headers.get('host')
  const origin = request.headers.get('origin')
  const referer = request.headers.get('referer')

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
