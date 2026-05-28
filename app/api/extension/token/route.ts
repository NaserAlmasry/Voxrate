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
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = adminClient()

  // Check if token already exists for this user
  const { data: existing } = await admin
    .from('extension_sessions')
    .select('token')
    .eq('user_id', user.id)
    .single()

  if (existing?.token) {
    return NextResponse.json({ token: existing.token }, {
      headers: { 'Cache-Control': 'no-store' },
    })
  }

  // Generate a new token
  const token = 'vox_' + crypto.randomBytes(24).toString('hex')

  await admin.from('extension_sessions').insert({
    user_id: user.id,
    token,
    created_at: new Date().toISOString(),
    last_seen_at: new Date().toISOString(),
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

  await admin
    .from('extension_sessions')
    .upsert(
      { user_id: user.id, token, created_at: new Date().toISOString(), last_seen_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    )

  return NextResponse.json({ token })
}
