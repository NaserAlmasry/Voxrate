// Cron: /api/cron/watchlist — runs daily at 9am UTC
// All plans: uses fetchProduct (ScrapingDog) — no Canopy, no star filters needed.
// Score = Math.round(averageRating * 20), so 4.3★ = 86/100.
// Starter: checked weekly (skipped if last_checked_at < 7 days ago).
// Growth/Pro: checked daily.
// Alert sent on any change >= 2 points (= 0.1★ shift).
// Canopy is reserved for Review Monitoring (Pro, individual review text).

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { verifyCronBearer } from '@/app/lib/cron-auth'
import { fetchProduct } from '@/app/lib/amazon-scraper'
import { sendCompetitorAlert } from '@/app/lib/email'

export const maxDuration = 300

function adminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

function extractAsin(url: string): string | null {
  if (!url) return null
  const m = url.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/i) || url.match(/^([A-Z0-9]{10})$/i)
  return m ? m[1].toUpperCase() : null
}

function ratingToScore(averageRating: number): number {
  return Math.min(100, Math.max(0, Math.round(averageRating * 20)))
}

export async function GET(request: NextRequest) {
  const authError = verifyCronBearer(request)
  if (authError) return authError

  const admin = adminClient()
  const now = new Date()

  // Fetch all watchlist items — all plans, sorted oldest-checked first
  const { data: watchlistItems } = await admin
    .from('watchlist')
    .select('id, user_id, product_url, product_name, last_score, report_id, last_checked_at, email_alerts_enabled')
    .order('last_checked_at', { ascending: true, nullsFirst: true })
    .limit(100)

  if (!watchlistItems || watchlistItems.length === 0) {
    return NextResponse.json({ ok: true, processed: 0 })
  }

  const userIds = [...new Set(watchlistItems.map((w: any) => w.user_id))]
  const { data: users } = await admin
    .from('users')
    .select('id, email, plan, is_admin')
    .in('id', userIds)

  const userMap = Object.fromEntries((users || []).map((u: any) => [u.id, u]))

  let processed = 0
  let skipped = 0

  for (const item of watchlistItems as any[]) {
    try {
      const user = userMap[item.user_id]
      if (!user?.email) { skipped++; continue }

      const isAdmin = user.is_admin === true
      const plan: string = user.plan || 'free'

      // Free plan has no watchlist access
      if (!isAdmin && plan === 'free') { skipped++; continue }

      // Starter: weekly cadence — skip if checked within last 7 days
      if (!isAdmin && plan === 'starter') {
        const lastChecked = item.last_checked_at ? new Date(item.last_checked_at) : null
        const sevenDaysAgo = new Date(now.getTime() - 7 * 86_400_000)
        if (lastChecked && lastChecked > sevenDaysAgo) { skipped++; continue }
      }
      // Growth/Pro: daily — no skip logic, cron cadence handles it

      const asin = extractAsin(item.product_url)
      const marketplace = item.product_url?.match(/amazon\.[a-z.]+/)?.[0] || 'amazon.com'
      if (!asin) { skipped++; continue }

      const { product } = await fetchProduct(asin, marketplace)

      // Guard: if API returned 0 rating the product is unavailable or response was bad.
      // Writing 0 would corrupt last_score and trigger a false "dropped to 0" alert.
      if (!product.averageRating || !product.totalReviews) { skipped++; continue }

      const newScore = ratingToScore(product.averageRating)
      const oldScore = item.last_score ?? 0
      const nowIso = now.toISOString()

      await admin.from('watchlist').update({
        last_score:      newScore,
        last_checked_at: nowIso,
      }).eq('id', item.id)

      void admin.from('watchlist_history').insert({
        watchlist_id: item.id,
        score:        newScore,
        checked_at:   nowIso,
      })

      // Alert on any change >= 2 points (0.1★) — both increases and drops
      const alertsEnabled = item.email_alerts_enabled !== false
      if (alertsEnabled && oldScore > 0 && Math.abs(newScore - oldScore) >= 2) {
        await sendCompetitorAlert({
          to:            user.email,
          productName:   item.product_name || asin,
          oldScore,
          newScore,
          reportId:      item.report_id || item.id,
          newComplaints: [],
        }).catch(() => {})
      }

      processed++
    } catch (e: any) {
      console.error(`[WatchlistCron] Failed for watchlist ${item.id}:`, e?.message)
      skipped++
    }
  }

  return NextResponse.json({ ok: true, processed, skipped, total: watchlistItems.length })
}
