// Vercel cron job — runs daily at 8am UTC
// Finds monitored listings due for a check, re-analyzes them,
// sends email alerts when score drops or new complaints appear.

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { sendMonitorAlert } from '@/app/lib/email'

export const maxDuration = 300

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const now = new Date()

  // Fetch up to 3 listings due for checking (oldest first to be fair)
  const { data: listings } = await supabase
    .from('monitored_listings')
    .select('*, users(email)')
    .eq('is_active', true)
    .order('last_checked_at', { ascending: true })
    .limit(3)

  if (!listings || listings.length === 0) {
    return NextResponse.json({ checked: 0 })
  }

  const due = listings.filter(l => {
    const last    = new Date(l.last_checked_at)
    const hoursAgo = (now.getTime() - last.getTime()) / 1000 / 3600
    return l.check_frequency === 'daily' ? hoursAgo >= 22 : hoursAgo >= 166
  })

  if (due.length === 0) {
    return NextResponse.json({ checked: 0, message: 'No listings due' })
  }

  const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://voxrate.app'
  let checked = 0

  for (const listing of due) {
    try {
      // Trigger re-analysis via the analyze API
      const res = await fetch(`${SITE_URL}/api/analyze`, {
        method:  'POST',
        headers: {
          'Content-Type':    'application/json',
          'X-Requested-With': 'XMLHttpRequest',
          'X-Cron-Secret':    process.env.CRON_SECRET || '',
        },
        body: JSON.stringify({
          productUrl:   listing.product_url,
          reAnalyze:    true,
          _cronUserId:  listing.user_id,
        }),
      })

      if (!res.ok) {
        console.error(`[Cron] Analysis failed for ${listing.product_url}`)
        continue
      }

      const { reportId } = await res.json()
      if (!reportId) continue

      // Wait briefly for report to be written
      await new Promise(r => setTimeout(r, 3000))

      // Fetch the new report
      const { data: newReport } = await supabase
        .from('reports')
        .select('health_score, full_report, status')
        .eq('id', reportId)
        .single()

      if (!newReport || newReport.status === 'pending') {
        // Report not ready — skip alert, update checked time
        await supabase
          .from('monitored_listings')
          .update({ last_checked_at: now.toISOString() })
          .eq('id', listing.id)
        continue
      }

      const newScore = newReport.health_score || 0
      const oldScore = listing.last_score     || 0
      const scoreDrop = oldScore - newScore

      // Get new complaint titles
      const oldReport = await supabase
        .from('reports')
        .select('full_report')
        .eq('id', listing.report_id)
        .single()

      const oldComplaints = new Set(
        (oldReport.data?.full_report?.complaints || []).map((c: any) => c.title?.toLowerCase())
      )
      const newComplaints = (newReport.full_report?.complaints || [])
        .filter((c: any) => !oldComplaints.has(c.title?.toLowerCase()))
        .map((c: any) => c.title)

      // Send alert if score dropped 5+ or new complaints appeared
      const shouldAlert = scoreDrop >= 5 || newComplaints.length > 0
      const userEmail = (listing as any).users?.email

      if (shouldAlert && userEmail) {
        await sendMonitorAlert({
          to:           userEmail,
          productName:  listing.product_name,
          oldScore,
          newScore,
          reportId,
          newComplaints,
        })
      }

      // Update monitored listing with new score and report
      await supabase
        .from('monitored_listings')
        .update({
          last_score:      newScore,
          last_checked_at: now.toISOString(),
          report_id:       reportId,
        })
        .eq('id', listing.id)

      checked++
      console.log(`[Cron] Checked ${listing.product_name}: ${oldScore} → ${newScore}, alert: ${shouldAlert}`)

    } catch (err: any) {
      console.error(`[Cron] Error processing ${listing.product_url}:`, err.message)
    }
  }

  return NextResponse.json({ checked, total: due.length })
}
