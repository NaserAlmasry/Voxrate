// Extension result submission — called by the Chrome extension after scraping Amazon reviews.
// Marks the job completed and caches the reviews in asin_review_cache.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { AmazonReview } from '@/app/lib/amazon-types'

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
    .select('user_id')
    .eq('token', token)
    .single()
  return data
}

export async function POST(req: NextRequest) {
  const auth = req.headers.get('Authorization') || ''
  const token = auth.replace('Bearer ', '').trim()
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const session = await getUserFromToken(token)
  if (!session) return NextResponse.json({ error: 'Invalid token' }, { status: 401 })

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

  const validReviews = (reviews || [])
    .filter((r: AmazonReview) => r.rating >= 1 && r.rating <= 5 && r.body && r.body.trim().length >= 20)
    .slice(0, 500)

  const partialErrors = new Set(['timeout', 'amazon_throttled'])
  const status = !amazonLoggedIn
    ? 'amazon_not_logged_in'
    : partialErrors.has(error ?? '')
    ? 'partial'
    : error
    ? 'failed'
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

  // Cache reviews in asin_review_cache so the main scraper can pick them up
  if (validReviews.length > 0) {
    const DOMAIN_MAP: Record<string, string> = {
      'amazon.com': 'US', 'amazon.co.uk': 'UK', 'amazon.ca': 'CA',
      'amazon.de': 'DE', 'amazon.fr': 'FR', 'amazon.it': 'IT',
      'amazon.es': 'ES', 'amazon.com.au': 'AU', 'amazon.co.jp': 'JP',
      'amazon.in': 'IN', 'amazon.com.mx': 'MX', 'amazon.com.br': 'BR',
    }
    const domain = DOMAIN_MAP[job.marketplace] ?? 'US'
    await supabase
      .from('asin_review_cache')
      .upsert(
        { asin: job.asin, domain, reviews: validReviews, cached_at: new Date().toISOString() },
        { onConflict: 'asin,domain' },
      )
  }

  return NextResponse.json({ ok: true, reviewsAccepted: validReviews.length })
}
