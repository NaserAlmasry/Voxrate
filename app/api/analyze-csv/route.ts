// ============================================================
// app/api/analyze-csv/route.ts
//
// SUBMISSION HANDLER
//
// In production with QStash configured:
//   - Validates, deducts credits, stores pending data, publishes to QStash
//   - Returns { reportId, queued: true } immediately
//
// In local dev or without QStash:
//   - Runs analysis directly (same as before)
//
// MODEL ROUTING (direct mode):
//  [ROUTING-1] Call 1 (Complaints):    Mistral Large Latest — hardest reasoning
//  [ROUTING-2] Call 2 (Strengths):     Mistral Large Latest — creative synthesis
//  [ROUTING-3] Call 3 (SEO+Marketing): Mistral Large 2411   — pure extraction
//  [ROUTING-4] Call 4 (Summary):       Mistral Large 2411   — formatting task
//  [ROUTING-5] Free preview:           Mistral Large 2411   — simple 2-complaint extraction
//
//  Groq is no longer used for inference calls.
//  getGroqRateLimitInfo is kept for legacy error detection in the outer catch.
//
//  Prompts: NOT changed.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/app/lib/supabase/server'
import {
  calculateHealthScore,
  applyHardOverrides,
  validateSemanticConstraints,
} from '@/app/lib/health-score'
import { enforceRateLimit } from '@/app/lib/rate-limit'
import { checkCsrf } from '@/app/lib/csrf'
import { getClientIp } from '@/app/lib/ip'
import { sendReportComplete, sendReportFailed } from '@/app/lib/email'
import { applyPlanLimits } from '@/app/lib/plan-limits'
import {
  analyzeFreeWithGroq,
  analyzeWithGroq,
  applyOutputGuardrails,
  applyDeterministicNarrative,
  getGroqRateLimitInfo,
  friendlyGroqLimitMessage,
  type ProductInfo,
} from '@/app/lib/csv-analysis'
import { getQStashClient, getWorkerUrl } from '@/app/lib/qstash'
import { parseCSV } from '@/app/lib/parse-csv'

export const maxDuration = 60

// ── Main handler ──────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const csrfError = checkCsrf(request)
  if (csrfError) return csrfError

  const ip = getClientIp(request)

  // Hoisted outside try so refundCsvCredits is accessible in outer catch
  let csvCreditsDeducted  = false
  let csvCreditsRefunded  = false
  const csvCreditCost     = 20
  let _refundSupabase: any = null
  let _refundUserId: string | null = null
  const refundCsvCredits  = async () => {
    if (!csvCreditsDeducted || csvCreditsRefunded || !_refundSupabase || !_refundUserId) return
    csvCreditsRefunded = true
    try {
      const { error } = await _refundSupabase.rpc('add_credits', { p_user_id: _refundUserId, p_amount: csvCreditCost })
      if (error) {
        console.error('[CSV] Credit refund RPC failed — MANUAL REVIEW NEEDED:', { userId: _refundUserId, amount: csvCreditCost, error: error.message })
      } else {
        console.log(`[CSV] Refunded ${csvCreditCost} credits to ${_refundUserId}`)
      }
    } catch (e: any) {
      console.error('[CSV] Credit refund threw — MANUAL REVIEW NEEDED:', { userId: _refundUserId, amount: csvCreditCost, error: e?.message })
    }
  }

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Please log in first' }, { status: 401 })

    _refundSupabase = supabase
    _refundUserId   = user.id

    const { data: userData } = await supabase.from('users').select('plan, is_admin').eq('id', user.id).single()
    const isAdminUser = userData?.is_admin === true

    if (!isAdminUser) {
      const limit = await enforceRateLimit(user.id, ip)
      if (!limit.allowed) {
        const resetIn = Math.ceil((limit.resetAt - Date.now()) / 60000)
        return NextResponse.json({ error: `Too many requests. Please wait ${resetIn} minute(s).` }, { status: 429 })
      }
    }

    const plan = userData?.plan || 'free'

    // Pre-claim the free plan slot before doing any work (both queue and direct mode).
    // This prevents the race where multiple simultaneous submissions bypass the 3/month limit.
    // On analysis failure the slot is consumed — this is acceptable (prevents abuse).
    const qstashEarly = getQStashClient()
    const isQueueMode = !!(qstashEarly && process.env.NODE_ENV === 'production')

    if (!isAdminUser && plan === 'free') {
      const { data: incremented } = await supabase.rpc('try_increment_analyses_count', {
        p_user_id: user.id,
        p_limit:   3,
      })
      if (!incremented) {
        return NextResponse.json({ error: 'Free plan limit reached.', upgradeRequired: true }, { status: 403 })
      }
    }

    if (!isAdminUser && plan === 'starter') {
      const { data: allowed } = await supabase.rpc('try_increment_starter_count', {
        p_user_id: user.id,
        p_limit:   25,
      })
      if (!allowed) {
        return NextResponse.json({ error: 'Starter plan limit reached. Please try again next month or upgrade to Pro.', upgradeRequired: true }, { status: 403 })
      }
    }

    if (!isAdminUser && (plan === 'growth' || plan === 'pro')) {
      const { data: userCreditData } = await supabase
        .from('users')
        .select('credits')
        .eq('id', user.id)
        .single()
      const currentCredits = userCreditData?.credits ?? 0
      if (currentCredits < csvCreditCost) {
        return NextResponse.json(
          { error: `Not enough credits. This analysis costs ${csvCreditCost} credits and you have ${currentCredits}.`, upgradeRequired: true, creditCost: csvCreditCost },
          { status: 403 },
        )
      }
      const { data: deducted, error: deductError } = await supabase.rpc('deduct_credits', {
        p_user_id: user.id,
        p_amount:  csvCreditCost,
      })
      if (deductError) {
        console.error('[CSV] Credit deduction failed:', deductError.message)
        return NextResponse.json({ error: 'Could not deduct credits. Please refresh and try again.' }, { status: 503 })
      }
      if (!deducted) {
        return NextResponse.json({ error: 'Not enough credits.', upgradeRequired: true }, { status: 403 })
      }
      csvCreditsDeducted = true
    }

    const formData    = await request.formData()
    const file        = formData.get('file') as File
    const rawName     = formData.get('productName')        as string | null
    const category    = formData.get('productCategory')    as string | null
    const price       = formData.get('price')              as string | null
    const rawDescription = formData.get('productDescription') as string | null
    const description = rawDescription ? rawDescription.trim().slice(0, 500).replace(/[<>]/g, '') : null

    console.log(`[CSV] productDescription received: ${description ? description.slice(0, 80) + '...' : 'NONE'}`)

    if (!file)                       return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    const safeFileName = file.name.replace(/[^a-zA-Z0-9._\- ]/g, '').slice(0, 100) || 'upload.csv'
    if (!file.name.endsWith('.csv') && !['text/csv', 'application/csv'].includes(file.type)) {
      return NextResponse.json({ error: 'Please upload a .csv file' }, { status: 400 })
    }

    // Size check BEFORE reading into memory
    const MAX_CSV_SIZE = 5 * 1024 * 1024 // 5MB
    if (file.size > MAX_CSV_SIZE) {
      return NextResponse.json({ error: 'File too large. Maximum size is 5MB.' }, { status: 400 })
    }

    // Magic-byte check — reject binary files masquerading as CSV
    const firstBytes = await file.slice(0, 4).arrayBuffer()
    const header     = new Uint8Array(firstBytes)
    const isBinary   = (
      (header[0] === 0x25 && header[1] === 0x50) || // %P (PDF)
      (header[0] === 0x50 && header[1] === 0x4B) || // PK (ZIP/XLSX)
      (header[0] === 0x4D && header[1] === 0x5A)    // MZ (EXE/DLL)
    )
    if (isBinary) {
      return NextResponse.json({ error: 'Invalid file type. Please upload a CSV text file.' }, { status: 400 })
    }

    const csvText = await file.text()
    let reviews: Array<{ rating: number; text: string; date: string }>

    try {
      reviews = parseCSV(csvText)
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }

    if (reviews.length > 5000) {
      return NextResponse.json({ error: 'CSV contains too many rows. Maximum 5,000 reviews per upload.' }, { status: 400 })
    }

    console.log(`[CSV] Parsed ${reviews.length} reviews from ${file.name}`)

    const { data: reportRow, error: reportError } = await supabase
      .from('reports')
      .insert({ user_id: user.id, product_url: `csv:${safeFileName}`, product_name: rawName?.trim() || safeFileName.replace('.csv', '').replace(/_/g, ' '), status: 'pending' })
      .select().single()

    if (reportError) throw reportError
    const reportId = reportRow.id

    const productInfo: ProductInfo = {
      name:        rawName?.trim() || safeFileName.replace('.csv', '').replace(/_/g, ' '),
      category:    category?.trim() || 'General',
      price:       price?.trim() || undefined,
      description: description?.trim() || undefined,
    }

    const reviewInput = reviews.map(({ rating, text }) => ({ rating, text }))

    // ── Queue mode (production + QStash configured) ───────────
    const qstash = qstashEarly

    if (isQueueMode) {
      await supabase.from('reports').update({
        full_report: {
          _pendingReviews: reviewInput,
          _productInfo:    productInfo,
          _plan:           plan,
          _isAdminUser:    isAdminUser,
          _userEmail:      user.email ?? null,
          _creditCost:     csvCreditCost,
        },
        status: 'queued',
      }).eq('id', reportId)

      await qstash!.publishJSON({
        url:     getWorkerUrl(),
        body:    { reportId, userId: user.id },
        retries: 0, // we handle retries internally
      })

      return NextResponse.json({
        success:     true,
        reportId,
        queued:      true,
        productName: productInfo.name,
        plan,
      })
    }

    // ── Direct mode (local dev or QStash not configured) ─────
    try {
      const ctx = calculateHealthScore(reviewInput, reviewInput.length)
      console.log(`[HealthScore] ${ctx.healthScore} | Raw: ${ctx.weightedRaw.toFixed(1)} | Penalties: ${ctx.penaltyCount}`)

      const useFreePreview  = !isAdminUser && plan === 'free'
      let analysis          = useFreePreview
        ? await analyzeFreeWithGroq(reviewInput, ctx, productInfo)
        : await analyzeWithGroq(reviewInput, ctx, productInfo)

      analysis = applyPlanLimits(analysis, plan, isAdminUser)

      await supabase.from('reports').update({
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

      // Increment analysis count for non-free plans (free slot was already claimed above)
      if (!isAdminUser && plan !== 'free') {
        const { error: countError } = await supabase.rpc('increment_analyses_count', { user_id: user.id })
        if (countError) console.error('[CSV] increment_analyses_count failed:', countError.message)
      }

      // Fire-and-forget completion email
      if (user.email) {
        sendReportComplete({
          to:          user.email,
          productName: productInfo.name,
          healthScore: analysis.healthScore,
          reportId,
        }).catch(e => console.error('[CSV] Completion email failed:', e.message))
      }

      return NextResponse.json({
        success:       true,
        reportId,
        productName:   productInfo.name,
        healthScore:   analysis.healthScore,
        totalReviewed: reviews.length,
        plan,
        isLimited:     plan === 'free' && !isAdminUser,
      })
    } catch (err: any) {
      console.error('[CSV] Pipeline error:', err instanceof Error ? err.message : String(err))
      await supabase.from('reports').update({ status: 'failed' }).eq('id', reportId)
      await refundCsvCredits()
      if (user.email) {
        sendReportFailed({ to: user.email, productName: productInfo.name })
          .catch(e => console.error('[CSV] Failure email failed:', e.message))
      }
      throw err
    }
  } catch (error: any) {
    console.error('[CSV Analyze] Unhandled error:', error instanceof Error ? error.message : String(error))
    await refundCsvCredits()
    const limitInfo = getGroqRateLimitInfo(error)
    if (limitInfo.isRateLimit) {
      return NextResponse.json({ error: friendlyGroqLimitMessage(limitInfo.retryAfterSeconds), retryAfterSeconds: limitInfo.retryAfterSeconds }, { status: 429 })
    }
    return NextResponse.json({ error: 'Analysis failed. Please try again or contact support.' }, { status: 500 })
  }
}
