// Vercel cron — runs daily at 8am UTC
// Scans recently completed reports and sends alerts when scores dropped
// or new complaints appeared vs the previous report for the same product.
// NO server-side scraping — alerts fire from data the extension already submitted.

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { verifyCronBearer } from '@/app/lib/cron-auth'
import { sendMonitorAlert, sendImmediateStarAlert } from '@/app/lib/email'
import { sendWebhookAlert, sendSlackAlert } from '@/app/lib/webhook'

export const maxDuration = 60

export async function GET(request: NextRequest) {
  const authError = verifyCronBearer(request)
  if (authError) return authError

  const supabase = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://voxrate.app'

  // Find reports completed in the last 25 hours that haven't been alerted on yet
  const since = new Date(Date.now() - 25 * 3600000).toISOString()

  const { data: recentReports } = await supabase
    .from('reports')
    .select('id, user_id, product_url, product_name, health_score, full_report, created_at')
    .eq('status', 'completed')
    .gte('last_analyzed_at', since)
    .order('last_analyzed_at', { ascending: false })
    .limit(50)

  if (!recentReports || recentReports.length === 0) {
    return NextResponse.json({ alerted: 0 })
  }

  let alerted = 0

  for (const report of recentReports) {
    // Get previous report for the same product URL (before this one)
    const { data: prevReport } = await supabase
      .from('reports')
      .select('id, health_score, full_report, last_analyzed_at')
      .eq('user_id', report.user_id)
      .eq('product_url', report.product_url)
      .eq('status', 'completed')
      .lt('last_analyzed_at', report.created_at)
      .order('last_analyzed_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!prevReport) continue

    const newScore  = report.health_score || 0
    const oldScore  = prevReport.health_score || 0
    const scoreDrop = oldScore - newScore

    const oldComplaints = new Set(
      (prevReport.full_report?.complaints || []).map((c: any) => c.title?.toLowerCase())
    )
    const newComplaints = (report.full_report?.complaints || [])
      .filter((c: any) => !oldComplaints.has(c.title?.toLowerCase()))
      .map((c: any) => c.title)

    const oldReviewIds = new Set(
      (prevReport.full_report?.reviews || [])
        .filter((r: any) => r.rating <= 2)
        .map((r: any) => r.id || r.reviewId || r.title?.toLowerCase())
        .filter(Boolean)
    )
    const badNewReviews = (report.full_report?.reviews || []).filter((r: any) => {
      if ((r.rating ?? 5) > 2) return false
      const rid = r.id || r.reviewId || r.title?.toLowerCase()
      return rid && !oldReviewIds.has(rid)
    })

    const shouldAlert = scoreDrop >= 5 || newComplaints.length > 0
    if (!shouldAlert && badNewReviews.length === 0) continue

    const { data: userData } = await supabase
      .from('users')
      .select('email, plan, webhook_url, slack_webhook_url')
      .eq('id', report.user_id)
      .single()

    if (!userData?.email) continue

    const userPlan = userData.plan || 'free'

    if (shouldAlert) {
      await sendMonitorAlert({
        to:           userData.email,
        productName:  report.product_name,
        oldScore,
        newScore,
        reportId:     report.id,
        newComplaints,
      }).catch(err => console.error('[Cron] Monitor alert failed:', err.message))
    }

    if (badNewReviews.length > 0 && oldReviewIds.size > 0 &&
        (userPlan === 'growth' || userPlan === 'pro')) {
      await sendImmediateStarAlert({
        to:          userData.email,
        productName: report.product_name,
        asin:        report.full_report?.asin || '',
        marketplace: report.full_report?.marketplace || 'amazon.com',
        reviews:     badNewReviews.slice(0, 5).map((r: any) => ({
          rating: r.rating,
          title:  r.title,
          body:   r.body,
        })),
        reportId: report.id,
      }).catch(err => console.error('[Cron] Star alert failed:', err.message))
    }

    // Webhook / Slack alerts
    const webhookBase = {
      asin:         report.full_report?.asin || '',
      product_name: report.product_name,
      report_url:   `${SITE_URL}/dashboard/report/${report.id}`,
      timestamp:    new Date().toISOString(),
    }
    if (shouldAlert && userData.webhook_url) {
      await sendWebhookAlert(userData.webhook_url, {
        ...webhookBase,
        event:     scoreDrop >= 5 ? 'score_drop' as const : 'new_complaint' as const,
        old_score: oldScore,
        new_score: newScore,
      }).catch(() => {})
    }
    if (shouldAlert && userData.slack_webhook_url) {
      await sendSlackAlert(userData.slack_webhook_url, {
        ...webhookBase,
        event:     scoreDrop >= 5 ? 'score_drop' as const : 'new_complaint' as const,
        old_score: oldScore,
        new_score: newScore,
      }).catch(() => {})
    }
    if (badNewReviews.length > 0 && oldReviewIds.size > 0) {
      const rev = badNewReviews[0]
      const starPayload = {
        ...webhookBase,
        event:       'new_1star_review' as const,
        rating:      rev.rating,
        review_text: rev.body?.slice(0, 500),
      }
      if (userData.webhook_url) await sendWebhookAlert(userData.webhook_url, starPayload).catch(() => {})
      if (userData.slack_webhook_url) await sendSlackAlert(userData.slack_webhook_url, starPayload).catch(() => {})
    }

    alerted++
  }

  return NextResponse.json({ alerted, scanned: recentReports.length })
}
