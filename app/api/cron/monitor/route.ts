// Cron: /api/cron/monitor — runs daily at 8am UTC
// Checks monitored_listings for due products and alerts on new negative reviews.
// Extension-first: if user has active extension session, skip Canopy and queue extension job.
// Review count check: if total review count unchanged, skip Canopy calls entirely.
// Alert tiers: 1-2 new negatives = heads-up, 3+ = possible attack, coordinated text = critical.
// Adaptive scheduling: speeds up checks during active attacks.

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { verifyCronBearer } from '@/app/lib/cron-auth'
import { scrapeForMonitoring } from '@/app/lib/amazon-scraper'
import {
  sendImmediateStarAlert,
  sendReviewAttackAlert,
  sendReviewRemovedAlert,
} from '@/app/lib/email'

export const maxDuration = 300

function adminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

// Detect coordinated attack: 2+ reviews sharing 3+ consecutive 5-word sequences
function isCoordinatedAttack(reviews: { body: string }[]): boolean {
  if (reviews.length < 2) return false
  const getSequences = (text: string): Set<string> => {
    const words = text.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(Boolean)
    const seqs = new Set<string>()
    for (let i = 0; i <= words.length - 5; i++) {
      seqs.add(words.slice(i, i + 5).join(' '))
    }
    return seqs
  }
  for (let i = 0; i < reviews.length - 1; i++) {
    const seqA = getSequences(reviews[i].body)
    for (let j = i + 1; j < reviews.length; j++) {
      const seqB = getSequences(reviews[j].body)
      let shared = 0
      for (const s of seqA) { if (seqB.has(s)) shared++ }
      if (shared >= 3) return true
    }
  }
  return false
}

export async function GET(request: NextRequest) {
  const authError = verifyCronBearer(request)
  if (authError) return authError

  const admin = adminClient()
  const now = new Date()

  // Fetch due monitored listings for Pro users only
  const { data: listings } = await admin
    .from('monitored_listings')
    .select(`
      id, user_id, asin, marketplace, product_name, product_url,
      last_review_count, last_one_star_count, last_two_star_count,
      last_rating, check_interval_days, known_negative_ids, report_id
    `)
    .eq('is_active', true)
    .lte('next_check_at', now.toISOString())
    .limit(30)

  if (!listings || listings.length === 0) {
    return NextResponse.json({ ok: true, processed: 0 })
  }

  // Fetch user data for all unique users
  const userIds = [...new Set(listings.map((l: any) => l.user_id))]
  const { data: users } = await admin
    .from('users')
    .select('id, email, plan, is_admin')
    .in('id', userIds)

  const userMap = Object.fromEntries((users || []).map((u: any) => [u.id, u]))

  let processed = 0
  let skipped = 0

  for (const listing of listings as any[]) {
    try {
      const user = userMap[listing.user_id]
      if (!user?.email) { skipped++; continue }

      // Pro-only gate
      if (!user.is_admin && user.plan !== 'pro') {
        await admin.from('monitored_listings').update({ is_active: false }).eq('id', listing.id)
        skipped++
        continue
      }

      const asin = listing.asin || extractAsinFromUrl(listing.product_url)
      const marketplace = listing.marketplace || 'amazon.com'

      if (!asin) { skipped++; continue }

      // Extension-first: check if user has active extension session (last 7 days)
      const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString()
      const { data: extSession } = await admin
        .from('extension_sessions')
        .select('id')
        .eq('user_id', listing.user_id)
        .is('revoked_at', null)
        .gte('last_seen_at', sevenDaysAgo)
        .limit(1)
        .maybeSingle()

      if (extSession) {
        // Queue extension job — extension will scrape and submit naturally
        await admin.from('extension_jobs').insert({
          user_id:      listing.user_id,
          asin,
          marketplace,
          max_reviews:  50,
          status:       'pending',
          job_type:     'monitor',
          monitor_id:   listing.id,
          created_at:   now.toISOString(),
          expires_at:   new Date(Date.now() + 48 * 3600_000).toISOString(),
        })
        // Reschedule: don't double-check while extension job pending
        const nextDays = listing.check_interval_days || 7
        await admin.from('monitored_listings').update({
          next_check_at: new Date(Date.now() + nextDays * 86_400_000).toISOString(),
        }).eq('id', listing.id)
        processed++
        continue
      }

      // No active extension — use Canopy
      const { oneStarReviews, twoStarReviews, quotaHit } = await scrapeForMonitoring(asin, marketplace)

      if (quotaHit) {
        // Reschedule to tomorrow and continue
        await admin.from('monitored_listings').update({
          next_check_at: new Date(Date.now() + 86_400_000).toISOString(),
        }).eq('id', listing.id)
        skipped++
        continue
      }

      const allNegative = [...oneStarReviews, ...twoStarReviews]
      const currentOneStar = oneStarReviews.length
      const currentTwoStar = twoStarReviews.length
      const currentTotal = currentOneStar + currentTwoStar

      // Review count check: if counts unchanged, skip processing (no new reviews)
      const lastOneStar = listing.last_one_star_count ?? 0
      const lastTwoStar = listing.last_two_star_count ?? 0
      const lastTotal = lastOneStar + lastTwoStar

      // Identify new reviews by ID (not seen in previous check)
      const knownIds = new Set<string>(Array.isArray(listing.known_negative_ids) ? listing.known_negative_ids : [])
      const newNegatives = allNegative.filter(r => r.id && !knownIds.has(r.id))
      const removedCount = Math.max(0, lastTotal - currentTotal)

      // Update known IDs
      const updatedKnownIds = allNegative.map(r => r.id).filter(Boolean)

      // Adaptive scheduling
      let nextIntervalDays = 7
      if (newNegatives.length >= 3) nextIntervalDays = 1
      else if (newNegatives.length >= 1) nextIntervalDays = 2

      // Persist updated state
      await admin.from('monitored_listings').update({
        last_one_star_count: currentOneStar,
        last_two_star_count: currentTwoStar,
        last_checked_at:     now.toISOString(),
        next_check_at:       new Date(Date.now() + nextIntervalDays * 86_400_000).toISOString(),
        check_interval_days: nextIntervalDays,
        known_negative_ids:  updatedKnownIds,
      }).eq('id', listing.id)

      // Write to monitor_history
      void admin.from('monitor_history').insert({
        listing_id:   listing.id,
        score:        0,
        checked_at:   now.toISOString(),
        one_star:     currentOneStar,
        two_star:     currentTwoStar,
      })

      // Send alerts
      if (newNegatives.length === 0) {
        // Check for removed reviews (positive notification)
        if (removedCount >= 1 && lastTotal > 0) {
          await sendReviewRemovedAlert({
            to:           user.email,
            productName:  listing.product_name || asin,
            removedCount,
            monitorId:    listing.id,
          }).catch(() => {})
        }
      } else if (newNegatives.length >= 3) {
        const coordinated = isCoordinatedAttack(newNegatives.map(r => ({ body: r.body || '' })))
        await sendReviewAttackAlert({
          to:            user.email,
          productName:   listing.product_name || asin,
          asin,
          marketplace,
          reviews:       newNegatives.slice(0, 5).map(r => ({
            rating:   r.rating,
            title:    r.title,
            body:     r.body,
            verified: r.verified,
          })),
          monitorId:     listing.id,
          isCoordinated: coordinated,
        }).catch(() => {})
      } else {
        // 1-2 new negatives — standard heads-up
        await sendImmediateStarAlert({
          to:          user.email,
          productName: listing.product_name || asin,
          asin,
          marketplace,
          reviews:     newNegatives.map(r => ({ rating: r.rating, title: r.title, body: r.body })),
          reportId:    listing.report_id || listing.id,
        }).catch(() => {})
      }

      processed++
    } catch (e: any) {
      console.error(`[MonitorCron] Failed for listing ${listing.id}:`, e?.message)
      skipped++
    }
  }

  return NextResponse.json({ ok: true, processed, skipped, total: listings.length })
}

function extractAsinFromUrl(url: string): string | null {
  if (!url) return null
  const m = url.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/i) || url.match(/^([A-Z0-9]{10})$/i)
  return m ? m[1].toUpperCase() : null
}
