// Sentiment Alerts cron worker — runs daily.
// Processes alerts where next_run_at <= now() and active = true.
// For each due alert:
//   1. Verify user plan (growth/pro) and credit balance
//   2. Scrape product via scrapeAmazonFree (1 Canopy call), filter to rating <= 2
//   3. Deduct credits via deduct_credits RPC
//   4. Email the user via Resend (sendSentimentAlert)
//   5. Update last_run_at and reschedule next_run_at

import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { scrapeAmazonFree } from '@/app/lib/amazon-scraper'
import { sendSentimentAlert } from '@/app/lib/email'
import { FREQUENCY_CREDITS, FREQUENCY_DAYS } from '@/app/api/sentiment-alerts/route'

export const maxDuration = 300

type Frequency = 'weekly' | 'biweekly' | 'triweekly' | 'monthly'

function nextRunISO(freq: Frequency, from = new Date()): string {
  return new Date(from.getTime() + FREQUENCY_DAYS[freq] * 86_400_000).toISOString()
}

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const authHeader = request.headers.get('authorization') || ''
  const expected = Buffer.from(`Bearer ${cronSecret}`)
  const actual   = Buffer.from(authHeader)
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const now = new Date()

  // Fetch alerts due. Limit to keep cron under maxDuration.
  const { data: alerts } = await supabase
    .from('sentiment_alerts')
    .select('*, users(email, plan, credits, is_admin)')
    .eq('active', true)
    .lte('next_run_at', now.toISOString())
    .order('next_run_at', { ascending: true })
    .limit(20)

  if (!alerts || alerts.length === 0) {
    return NextResponse.json({ processed: 0 })
  }

  let processed = 0
  let skipped   = 0
  let emailed   = 0

  for (const alert of alerts) {
    const user = (alert as any).users
    const freq = alert.frequency as Frequency
    const cost = FREQUENCY_CREDITS[freq] ?? 5

    try {
      if (!user?.email) { skipped++; continue }

      const plan    = user.plan || 'free'
      const isAdmin = user.is_admin === true
      const credits = user.credits ?? 0

      // Plan gate — only growth/pro (admins always allowed)
      if (!isAdmin && plan !== 'growth' && plan !== 'pro') {
        await supabase
          .from('sentiment_alerts')
          .update({ active: false })
          .eq('id', alert.id)
        skipped++
        continue
      }

      // Credit check — pause alert if insufficient
      if (!isAdmin && credits < cost) {
        await supabase
          .from('sentiment_alerts')
          .update({ active: false })
          .eq('id', alert.id)
        console.log(`[SentimentCron] Paused alert ${alert.id} — insufficient credits`)
        skipped++
        continue
      }

      // Scrape (1 Canopy call) and filter to 1★/2★
      const productInput = `https://www.${alert.marketplace}/dp/${alert.asin}`
      const scraped      = await scrapeAmazonFree(productInput)
      const negative     = (scraped.reviews || []).filter(r => (r.rating ?? 3) <= 2)

      // Filter to reviews newer than last_run_at when we have a date on the review.
      // Canopy free scrape often returns date='' — when missing, include the review.
      const lastRun = alert.last_run_at ? new Date(alert.last_run_at) : null
      const fresh   = negative.filter(r => {
        if (!lastRun || !r.date) return true
        const reviewDate = new Date(r.date)
        if (isNaN(reviewDate.getTime())) return true
        return reviewDate > lastRun
      })

      // Deduct credits (only if we actually performed the scan)
      if (!isAdmin) {
        const { data: deducted, error: deductErr } = await supabase.rpc('deduct_credits', {
          p_user_id: alert.user_id,
          p_amount:  cost,
        })
        if (deductErr || !deducted) {
          console.error(`[SentimentCron] deduct_credits failed for ${alert.id}:`, deductErr?.message)
          await supabase
            .from('sentiment_alerts')
            .update({ active: false })
            .eq('id', alert.id)
          skipped++
          continue
        }
      }

      // Email the digest (we always email — owner wants the run reported)
      try {
        await sendSentimentAlert({
          to:             user.email,
          productName:    alert.product_name || scraped.product?.title || alert.asin,
          asin:           alert.asin,
          marketplace:    alert.marketplace,
          reviews:        fresh.map(r => ({ rating: r.rating, title: r.title, body: r.body })),
          frequency:      freq,
          creditsCharged: isAdmin ? 0 : cost,
        })
        emailed++
      } catch (mailErr: any) {
        console.error(`[SentimentCron] Email send failed for ${alert.id}:`, mailErr?.message)
      }

      await supabase
        .from('sentiment_alerts')
        .update({
          last_run_at: now.toISOString(),
          next_run_at: nextRunISO(freq, now),
        })
        .eq('id', alert.id)

      processed++
      console.log(`[SentimentCron] Alert ${alert.id} (${alert.asin}) — ${fresh.length} new negative reviews`)
    } catch (err: any) {
      console.error(`[SentimentCron] Error processing alert ${alert.id}:`, err?.message)
    }
  }

  return NextResponse.json({ processed, emailed, skipped, total: alerts.length })
}
