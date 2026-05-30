// Extension result submission — called by the Chrome extension after scraping Amazon reviews.
// Marks the job completed and caches the reviews in asin_review_cache.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { AmazonReview } from '@/app/lib/amazon-types'
import { checkRateLimit } from '@/app/lib/rate-limit'

// 20 submissions per hour per token (3600s window, sliding per 10-min bucket × 6)
const SUBMIT_RATE_LIMIT = 20

// HTML tag pattern for review content validation
const HTML_TAG_RE = /<[^>]+>/

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

// NOTE: requires extension_sessions to have `revoked_at timestamptz` and `expires_at timestamptz` columns.
async function getUserFromToken(token: string) {
  const supabase = adminClient()
  const { data } = await supabase
    .from('extension_sessions')
    .select('user_id')
    .eq('token', token)
    .is('revoked_at', null)
    .gt('expires_at', new Date().toISOString())
    .single()
  return data
}

export async function POST(req: NextRequest) {
  const auth = req.headers.get('Authorization') || ''
  const token = auth.replace('Bearer ', '').trim()
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const session = await getUserFromToken(token)
  if (!session) return NextResponse.json({ error: 'Invalid token' }, { status: 401 })

  // BUG 4 fix: rate limit — 20 submissions per hour per token
  const rateLimitResult = await checkRateLimit(`ext-submit:${token}`, 'user', SUBMIT_RATE_LIMIT)
  if (!rateLimitResult.allowed) {
    return NextResponse.json({ error: 'Too many submissions. Please wait before submitting again.' }, { status: 429 })
  }

  // Check plan access — paid plans OR active trial only
  const supabaseCheck = adminClient()
  const { data: userData } = await supabaseCheck
    .from('users')
    .select('plan, trial_ends_at')
    .eq('id', session.user_id)
    .single()

  const VALID_PLANS = ['starter', 'growth', 'pro', 'trial']
  const isTrial = userData?.trial_ends_at && new Date(userData.trial_ends_at) > new Date()
  const hasPaidPlan = VALID_PLANS.includes(userData?.plan ?? '')
  if (!hasPaidPlan && !isTrial) {
    return NextResponse.json({ error: 'trial_expired' }, { status: 403 })
  }

  let body: { jobId: string; reviews: AmazonReview[]; amazonLoggedIn: boolean; error?: string | null }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { jobId, reviews, amazonLoggedIn, error } = body
  if (!jobId) return NextResponse.json({ error: 'Missing jobId' }, { status: 400 })

  const supabase = adminClient()

  // Verify job belongs to this user (accept even if backend already marked it failed/timed out)
  const { data: job } = await supabase
    .from('extension_jobs')
    .select('id, asin, marketplace, user_id, status')
    .eq('id', jobId)
    .eq('user_id', session.user_id)
    .single()

  if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  if (job.status === 'failed') return NextResponse.json({ error: 'Job expired' }, { status: 409 })

  // BUG 4 fix: validate review content — max 5000 chars body, no HTML tags
  const validReviews = (reviews || [])
    .filter((r: AmazonReview) => {
      if (r.rating < 1 || r.rating > 5) return false
      if (!r.body || r.body.trim().length < 20) return false
      if (r.body.length > 5000) return false
      if (HTML_TAG_RE.test(r.body)) return false
      return true
    })
    .slice(0, 500)

  const partialErrors = new Set(['timeout', 'amazon_throttled'])
  const status = !amazonLoggedIn
    ? 'amazon_not_logged_in'
    : partialErrors.has(error ?? '')
    ? 'partial'
    : error
    ? 'failed'
    : validReviews.length === 0
    ? 'partial'   // logged-in scrape with no reviews = unexpected, treat as partial not completed
    : 'completed'

  await supabase
    .from('extension_jobs')
    .update({
      status,
      reviews: validReviews,
      error: error || null,
      completed_at: new Date().toISOString(),
    })
    .eq('id', jobId)

  return NextResponse.json({ ok: true, reviewsAccepted: validReviews.length })
}
