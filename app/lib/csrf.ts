import { NextRequest, NextResponse } from 'next/server'

// CSRF protection via X-Requested-With header check.
// Browsers send cross-site requests without custom headers, so requiring
// this header blocks CSRF attacks while allowing normal fetch() calls
// that set it explicitly.

export function checkCsrf(request: NextRequest): NextResponse | null {
  const xrw = request.headers.get('x-requested-with')
  if (xrw !== 'XMLHttpRequest') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  return null
}
