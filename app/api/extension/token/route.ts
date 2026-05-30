// Returns (or creates) the user's extension token.
// Called from voxrate.app/settings/extension page.
// The token is a random hex string stored in extension_sessions table.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/app/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { checkCsrf } from '@/app/lib/csrf'
import crypto from 'crypto'

function adminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function GET(_req: NextRequest) {
  const origin = _req.headers.get('origin')
  const extensionId = process.env.CHROME_EXTENSION_ID
  const allowedOrigins = [
    'https://voxrate.app',
    ...(extensionId ? [`chrome-extension://${extensionId}`] : ['chrome-extension://']),
  ]
  if (origin && !allowedOrigins.some(o => origin.startsWith(o))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = adminClient()

  // Check if token already exists for this user (not revoked, not expired)
  const { data: existing } = await admin
    .from('extension_sessions')
    .select('token')
    .eq('user_id', user.id)
    .is('revoked_at', null)
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
    .maybeSingle()

  if (existing?.token) {
    return NextResponse.json({ token: existing.token }, {
      headers: { 'Cache-Control': 'no-store' },
    })
  }

  // Generate a new token
  const token = 'vox_' + crypto.randomBytes(24).toString('hex')

  const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString() // 1 year
  await admin.from('extension_sessions').insert({
    user_id: user.id,
    token,
    expires_at: expiresAt,
    created_at: new Date().toISOString(),
    last_seen_at: new Date().toISOString(),
    user_agent: _req.headers.get('user-agent')?.slice(0, 255) ?? null,
  })

  return NextResponse.json({ token }, {
    headers: { 'Cache-Control': 'no-store' },
  })
}

// Regenerate token (invalidates old one)
export async function POST(req: NextRequest) {
  const csrfError = checkCsrf(req)
  if (csrfError) return csrfError

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = adminClient()
  const token = 'vox_' + crypto.randomBytes(24).toString('hex')

  const newExpiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
  await admin
    .from('extension_sessions')
    .upsert(
      { user_id: user.id, token, expires_at: newExpiresAt, created_at: new Date().toISOString(), last_seen_at: new Date().toISOString(), user_agent: req.headers.get('user-agent')?.slice(0, 255) ?? null },
      { onConflict: 'user_id' },
    )

  return NextResponse.json({ token })
}
