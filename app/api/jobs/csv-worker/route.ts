// ============================================================
// app/api/jobs/csv-worker/route.ts
//
// QStash worker — called by Upstash QStash after a CSV analysis job is queued.
// Runs the full analysis server-side even if the user's browser disconnects.
//
// maxDuration = 300 — Vercel fluid function / pro plan required.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { Receiver } from '@upstash/qstash'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import {
  analyzeWithGroq,
  analyzeFreeWithGroq,
  type ProductInfo,
} from '@/app/lib/csv-analysis'
import {
  calculateHealthScore,
  applyHardOverrides,
  validateSemanticConstraints,
} from '@/app/lib/health-score'
import { applyPlanLimits } from '@/app/lib/plan-limits'
import { sendReportComplete, sendReportFailed } from '@/app/lib/email'

export const maxDuration = 300

export async function POST(request: NextRequest) {
  // 1. Verify QStash signature
  const receiver = new Receiver({
    currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY!,
    nextSigningKey:    process.env.QSTASH_NEXT_SIGNING_KEY!,
  })

  const body = await request.text()
  try {
    await receiver.verify({
      signature: request.headers.get('upstash-signature') ?? '',
      body,
    })
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const { reportId, userId } = JSON.parse(body)

  // Use service role to bypass RLS — worker runs outside user session
  const supabase = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  // 2. Fetch pending data
  const { data: report, error: fetchError } = await supabase
    .from('reports')
    .select('full_report, status')
    .eq('id', reportId)
    .single()

  if (fetchError || !report) {
    console.error('[Worker] Report not found:', reportId)
    return NextResponse.json({ error: 'Report not found' }, { status: 404 })
  }

  if (report.status !== 'queued') {
    console.warn('[Worker] Report not in queued state, skipping:', reportId, report.status)
    return NextResponse.json({ ok: true })
  }

  const pending     = report.full_report as any
  const reviews     = pending._pendingReviews as Array<{ rating: number; text: string }>
  const productInfo = pending._productInfo   as ProductInfo
  const plan        = pending._plan          as string
  const isAdminUser = pending._isAdminUser   as boolean
  const userEmail   = pending._userEmail     as string | null
  const creditCost: number = pending._creditCost ?? 20

  if (!reviews?.length || !productInfo) {
    console.error('[Worker] Missing pending data for report:', reportId)
    await supabase.from('reports').update({ status: 'failed' }).eq('id', reportId)
    return NextResponse.json({ ok: true })
  }

  // 3. Run analysis
  try {
    await supabase.from('reports').update({ status: 'processing' }).eq('id', reportId)

    const ctx            = calculateHealthScore(reviews, reviews.length)
    const useFreePreview = !isAdminUser && plan === 'free'
    let analysis         = useFreePreview
      ? await analyzeFreeWithGroq(reviews, ctx, productInfo)
      : await analyzeWithGroq(reviews, ctx, productInfo)

    const { data: patched, overrides } = applyHardOverrides(analysis, ctx)
    if (overrides.length > 0) console.warn('[Worker][HardOverrides] Patched:', overrides)
    analysis = patched

    try {
      validateSemanticConstraints(analysis, ctx)
    } catch (semErr) {
      console.warn('[Worker][SemanticCheck] Validation threw — skipping:', semErr)
    }

    analysis = applyPlanLimits(analysis, plan, isAdminUser)

    const { error: updateError } = await supabase.from('reports').update({
      product_name:           productInfo.name,
      health_score:           analysis.healthScore,
      total_reviews_analyzed: reviews.length,
      top_complaint:          analysis.complaints?.[0]?.title   || null,
      top_strength:           analysis.strengths?.[0]?.title    || null,
      top_improvement:        analysis.improvements?.[0]?.title || null,
      full_report:            analysis,
      status:                 'completed',
      last_analyzed_at:       new Date().toISOString(),
    }).eq('id', reportId)

    if (updateError) {
      console.error('[Worker] Report update failed — refunding:', updateError.message)
      await supabase.rpc('add_credits', { p_user_id: userId, p_amount: creditCost })
      await supabase.from('reports').update({ status: 'failed' }).eq('id', reportId)
      if (userEmail) sendReportFailed({ to: userEmail, productName: productInfo.name }).catch(() => {})
      return NextResponse.json({ ok: true })
    }

    // Free plan slot already claimed in the submission handler — only increment for paid plans
    if (!isAdminUser && plan !== 'free') {
      await supabase.rpc('increment_analyses_count', { user_id: userId })
    }

    if (userEmail) {
      sendReportComplete({
        to:          userEmail,
        productName: productInfo.name,
        healthScore: analysis.healthScore,
        reportId,
      }).catch(e => console.error('[Worker] Completion email failed:', e.message))
    }

    console.log(`[Worker] Completed report ${reportId} — score: ${analysis.healthScore}`)
    return NextResponse.json({ ok: true })

  } catch (err: any) {
    console.error('[Worker] Analysis failed:', err.message)
    await supabase.rpc('add_credits', { p_user_id: userId, p_amount: creditCost })
    await supabase.from('reports').update({ status: 'failed' }).eq('id', reportId)
    if (userEmail) sendReportFailed({ to: userEmail, productName: productInfo.name }).catch(() => {})
    // Always return 200 — we handle errors internally, don't want QStash to retry
    return NextResponse.json({ ok: true })
  }
}
