// Extension polling endpoint — returns the oldest pending scrape job for the authenticated user.
// Called every ~5 seconds by the Chrome extension background service worker.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const JOB_TIMEOUT_MS = 120_000 // abandon jobs older than 2 minutes (extension wasn't running)

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

async function getUserFromToken(token: string) {
  const supabase = adminClient()
  const { data } = await supabase
    .from('extension_sessions')
    .select('user_id, last_seen_at')
    .eq('token', token)
    .single()
  return data
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get('Authorization') || ''
  const token = auth.replace('Bearer ', '').trim()
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const session = await getUserFromToken(token)
  if (!session) return NextResponse.json({ error: 'Invalid token' }, { status: 401 })

  const supabase = adminClient()

  // Update heartbeat
  await supabase
    .from('extension_sessions')
    .update({ last_seen_at: new Date().toISOString() })
    .eq('token', token)

  // Mark stale pending/processing jobs as failed (extension crashed or was offline)
  const staleThreshold = new Date(Date.now() - JOB_TIMEOUT_MS).toISOString()
  await supabase
    .from('extension_jobs')
    .update({ status: 'failed', error: 'Extension offline — job timed out' })
    .eq('user_id', session.user_id)
    .in('status', ['pending', 'processing'])
    .lt('created_at', staleThreshold)

  // Fetch oldest pending job
  const { data: job } = await supabase
    .from('extension_jobs')
    .select('id, asin, marketplace, max_reviews')
    .eq('user_id', session.user_id)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (!job) return NextResponse.json({ job: null })

  // Mark as processing so we don't double-dispatch
  await supabase
    .from('extension_jobs')
    .update({ status: 'processing', started_at: new Date().toISOString() })
    .eq('id', job.id)

  return NextResponse.json({ job })
}
