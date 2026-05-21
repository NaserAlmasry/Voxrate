// ============================================================
// app/api/analyze/route.ts
//
// Amazon review analysis — scrapes via Rainforest/Canopy APIs (amazon-scraper.ts).
//
// ENV VARS NEEDED:
//   RAINFOREST_API_KEY — from rainforestapi.com dashboard
//
// MODEL ROUTING:
//  Complaints (full analysis): Mistral Large Latest → fallback Mistral Large 2411
//  Free preview:               Mistral Large 2411 (200B/month free pool, direct)
//  Strengths, SEO, Summary:    Mistral Large 2411 (200B/month free pool, direct)
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { callMistral2411, callMistralLatest, resetSessionTokens, getSessionTokens, type Message } from '@/app/lib/mistral-fallback'
import { createClient } from '@/app/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import {
  calculateHealthScore,
  formatHealthScoreForPrompt,
  applyHardOverrides,
  validateSemanticConstraints,
} from '@/app/lib/health-score'
import { applyPlanLimits } from '@/app/lib/plan-limits'
import { enforceRateLimit } from '@/app/lib/rate-limit'
import { checkCsrf } from '@/app/lib/csrf'
import {
  generateDomainAndSeo,
  extractWorstReviews,
  extractBestReviews,
} from '@/app/lib/domain-knowledge'
import { extractPatterns, buildSmartSample } from '@/app/lib/pattern-extractor'
import { calculateSeoScore } from '@/app/lib/seo-scorer'
import { sendReportComplete } from '@/app/lib/email'
import { scrapeAmazon, scrapeAmazonFree } from '@/app/lib/amazon-scraper'
import type { AmazonReview } from '@/app/lib/amazon-types'
import { extractJson } from '@/app/lib/extract-json'
import { sanitizeReview } from '@/app/lib/sanitize-review'
import { getComplaintCountGuidance } from '@/app/lib/complaint-guidance'
import { CREDIT_COSTS } from '@/app/lib/credit-costs'
import { sanitizeAmazonInput } from '@/app/lib/amazon-url'
import { verifyCronRequest } from '@/app/lib/cron-auth'
import {
  COMPLAINTS_SYSTEM_PROMPT,
  FREE_PREVIEW_SYSTEM_PROMPT,
  buildComplaintsPrompt,
  buildComplaintsRetryPrompt,
  buildFreePreviewPrompt,
} from '@/app/lib/analysis-prompts'

export const maxDuration = 300

// ── Retry wrapper ─────────────────────────────────────────────

function isRetryable(err: any): boolean {
  const status = err?.status ?? err?.statusCode ?? 0
  return status === 0 || status >= 500 // network error or server error only
}

async function withRetry<T>(fn: () => Promise<T>, retries = 2): Promise<T> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      if (attempt === retries || !isRetryable(err)) throw err
      const delay = 1500 * (attempt + 1)
      console.log(`[Retry] Attempt ${attempt + 1} failed, retrying in ${delay}ms`)
      await new Promise((r) => setTimeout(r, delay))
    }
  }
  throw new Error('Max retries exceeded')
}

// ── Complaint count guidance ──────────────────────────────────

// ── Main analysis ─────────────────────────────────────────────

async function analyzeProduct(
  product:             any,
  reviews:             AmazonReview[],
  ctx:                 ReturnType<typeof calculateHealthScore>,
  listingDescription?: string,
): Promise<any> {
  // Convert AmazonReview[] to the shape pattern-extractor expects
  const reviewsForPatterns = reviews.map(r => ({
    rating:   r.rating,
    text:     r.body,
    verified: r.verified,
    vine:     r.vine,
  }))
  const patterns       = extractPatterns(reviewsForPatterns)
  const sampledReviews = buildSmartSample(reviewsForPatterns, patterns, 200)

  const reviewText = sampledReviews
    .map(r =>
      `[${r.rating}★] ${sanitizeReview(r.text).slice(0, 300).trimEnd()}` +
      (r.text.length > 300 ? '…' : ''),
    )
    .join('\n')

  const negativeReviews = sampledReviews.filter(r => r.rating <= 2).slice(0, 50)
  const positiveReviews = sampledReviews.filter(r => r.rating >= 4).slice(0, 50)
  const fiveStarReviews = sampledReviews.filter(r => r.rating === 5).slice(0, 30)

  const negReviewText = (negativeReviews.length > 0 ? negativeReviews : sampledReviews.slice(0, 20))
    .map(r =>
      `[${r.rating}★] ${sanitizeReview(r.text).slice(0, 200).trimEnd()}` +
      (r.text.length > 200 ? '…' : ''),
    ).join('\n')

  const posReviewText = (positiveReviews.length > 0 ? positiveReviews : sampledReviews.slice(0, 25))
    .map(r =>
      `[${r.rating}★] ${sanitizeReview(r.text).slice(0, 200).trimEnd()}` +
      (r.text.length > 200 ? '…' : ''),
    ).join('\n')

  const fiveStarText = (fiveStarReviews.length > 0 ? fiveStarReviews : positiveReviews.slice(0, 10))
    .map(r =>
      `[5★] ${sanitizeReview(r.text).slice(0, 180).trimEnd()}` +
      (r.text.length > 180 ? '…' : ''),
    ).join('\n')

  console.log(
    `[Parallel] Review splits — neg: ${negativeReviews.length}, ` +
    `pos: ${positiveReviews.length}, 5★: ${fiveStarReviews.length}`,
  )

  const healthBlock    = formatHealthScoreForPrompt(ctx)
  const negativeCount  = sampledReviews.filter(r => r.rating <= 2).length
  const complaintGuide = getComplaintCountGuidance(reviews.length, negativeCount, sampledReviews.length)

  // Convert for domain knowledge (uses text field)
  const reviewsForDomain = reviews.map(r => ({ rating: r.rating, text: r.body, verified: r.verified }))
  const worstReviews     = extractWorstReviews(reviewsForDomain)
  const bestReviews      = extractBestReviews(reviewsForDomain, 15)

  // Convert for SEO scorer — run in parallel with domain knowledge (improvement #5)
  const reviewsForSeo = reviews.map(r => ({ rating: r.rating, text: r.body }))

  const [domainResult, seoAnalysis] = await Promise.all([
    generateDomainAndSeo(
      product.title, product.category || 'Amazon Product',
      worstReviews, bestReviews, listingDescription,
    ),
    Promise.resolve(calculateSeoScore(reviewsForSeo, product.title)),
  ])

  const domainKnowledge = domainResult.knowledge
  const seoTopPhrases = domainResult.seoThemes.length >= 3
    ? domainResult.seoThemes
    : seoAnalysis.topPhrases

  console.log(
    `[SEO] Score: ${seoAnalysis.score}/100 | ` +
    `Themes: ${seoTopPhrases.slice(0, 3).join(' | ')}`,
  )

  const negCount = ctx.starCounts[1] + ctx.starCounts[2]
  const negPct   = ctx.totalReviewCount > 0
    ? Math.round((negCount / ctx.totalReviewCount) * 100)
    : 0

  const descriptionLine = listingDescription
    ? `\nSELLER'S LISTING DESCRIPTION (bullet points/description):\n<listing_description>${listingDescription.slice(0, 400).trimEnd()}</listing_description>\n`
    : ''

  const listingIntelligence = `LISTING INTELLIGENCE:
- Images: ${ctx.imageCount} (top listings in this category average 7+)
- Has A+ Content: ${ctx.hasAplus ? 'Yes' : 'No — competitors with A+ content convert 3-5% higher'}
- Has Video: ${ctx.videoCount > 0 ? `Yes (${ctx.videoCount} videos)` : 'No — video increases conversion'}
- BSR: ${ctx.bsr ? `#${ctx.bsr} in ${ctx.bsrCategory}` : 'Not ranked'}
- Verified review health score: ${ctx.verifiedHealthScore}/100
- Fake review flag: ${ctx.fakeReviewFlag ? 'WARNING: High ratio of unverified negative reviews detected' : 'Clean'}
- Unanswered buyer questions: ${ctx.unansweredQACount}`

  // Build star breakdown as percentages (improvement #9)
  const totalRatings = ctx.totalReviewCount || 1
  const starPctLine = [5, 4, 3, 2, 1]
    .map(s => `${s}★:${Math.round((ctx.starCounts[s as 1|2|3|4|5] / totalRatings) * 100)}%`)
    .join(' ')

  const bsrLine = ctx.bsr
    ? `BSR: #${ctx.bsr.toLocaleString()} in ${ctx.bsrCategory || 'Unknown Category'}`
    : 'BSR: Not ranked'

  const contextBlock = `PRODUCT: <product_title>${product.title}</product_title>
ASIN: ${product.asin || ''}
MARKETPLACE: ${product.marketplace || 'amazon.com'}
PRICE: $${product.price || 'N/A'}
RATING: ${product.averageRating || product.rating}/5
TOTAL RATINGS: ${ctx.totalReviewCount.toLocaleString()}
${bsrLine}
STAR BREAKDOWN: ${starPctLine}
REVIEWS ANALYZED: ${reviews.length}${descriptionLine}

${healthBlock}

${listingIntelligence}

${patterns.promptSummary}

${domainKnowledge}

Classify each issue as SHIPPING / PRODUCTION / LISTING / DESIGN / COMPATIBILITY before writing fixes.`

  const systemPrompt = COMPLAINTS_SYSTEM_PROMPT

  console.log(`[Section:complaints] Starting for ${reviews.length} reviews...`)

  // ── Call 1: COMPLAINTS — Mistral Large Latest ────────────
  const complaintsRaw = await callMistralLatest([
    { role: 'system' as const, content: systemPrompt },
    {
      role: 'user' as const,
      content: buildComplaintsPrompt({ contextBlock, complaintGuide, negReviewText }),
    },
  ], 5500)

  let complaintsData: any = { complaints: [] }
  try {
    const rawParsed = extractJson(complaintsRaw) as any
    if (Array.isArray(rawParsed?.complaints)) {
      complaintsData = rawParsed
    } else if (Array.isArray(rawParsed)) {
      complaintsData = { complaints: rawParsed }
    } else {
      const firstArray = Object.values(rawParsed || {}).find(v => Array.isArray(v))
      if (firstArray) complaintsData = { complaints: firstArray }
    }
    console.log(`[Section:complaints] Parsed — ${complaintsData.complaints?.length || 0} found`)
  } catch (e) {
    console.error('[Section:complaints] Parse FAILED:', String(e).slice(0, 200))
  }

  if (!complaintsData.complaints || complaintsData.complaints.length === 0) {
    console.warn('[Section:complaints] 0 complaints — retrying on 70b...')
    await new Promise(r => setTimeout(r, 2000))
    try {
      const retryRaw = await callMistralLatest([
        { role: 'system' as const, content: systemPrompt },
        {
          role: 'user' as const,
          content: buildComplaintsRetryPrompt({ contextBlock, reviewText }),
        },
      ], 5000)
      const retryParsed = extractJson(retryRaw) as any
      if (Array.isArray(retryParsed?.complaints) && retryParsed.complaints.length > 0) {
        complaintsData = retryParsed
        console.log(`[Section:complaints] Retry succeeded — ${complaintsData.complaints.length} found`)
      }
    } catch (retryErr) {
      console.error('[Section:complaints] Retry also failed:', retryErr)
    }
  }

  const topComplaintTitle = complaintsData.complaints?.[0]?.title || 'quality issues'

  const partialReport: any = {
    healthScore:   ctx.healthScore,
    starBreakdown: {
      '1': ctx.starCounts[1],
      '2': ctx.starCounts[2],
      '3': ctx.starCounts[3],
      '4': ctx.starCounts[4],
      '5': ctx.starCounts[5],
    },
    complaints:      Array.isArray(complaintsData.complaints) ? complaintsData.complaints : [],
    strengths:       [],
    improvements:    [],
    seo:             null,
    marketingCopy:   [],
    reviewTemplates: [],
    careGuide:       null,
    quickWin:        null,
    topActions:      [],
    freeSummary:     '',
    keyInsight:      '',
    summary:         '',
    _cache: {
      contextBlock,
      negReviewText,
      posReviewText,
      fiveStarText,
      reviewText,
      seoScore:         seoAnalysis.score,
      seoReasoning:     seoAnalysis.reasoning,
      seoTopPhrases,
      negPct,
      topComplaintTitle,
    },
    _sectionsReady: ['complaints'],
  }

  return partialReport
}

// ── Free preview — single cheap call ─────────────────────────

async function analyzeFreePreview(
  product: any,
  reviews: AmazonReview[],
  ctx: ReturnType<typeof calculateHealthScore>,
  listingDescription?: string,
): Promise<any> {
  const reviewsNorm = reviews.map(r => ({ rating: r.rating, text: r.body, verified: r.verified, vine: r.vine }))
  const patterns        = extractPatterns(reviewsNorm)
  const sampledReviews  = buildSmartSample(reviewsNorm, patterns, 60)
  const negativeReviews = sampledReviews.filter(r => r.rating <= 2).slice(0, 18)
  const positiveReviews = sampledReviews.filter(r => r.rating >= 4).slice(0, 12)
  const sanitizeFree = (t: string) =>
    t.replace(/ignore\s+(previous|all|above|prior)\s+(instructions?|prompts?|context)/gi, '[…]')
     .replace(/system\s*:/gi, '[…]').replace(/assistant\s*:/gi, '[…]')
     .replace(/disregard\s+(all|previous|prior|above)/gi, '[…]')
     .replace(/forget\s+(all|previous|prior|above)/gi, '[…]')
     .replace(/override\s+(your|all|previous)/gi, '[…]')
     .replace(/\bdo not follow\b/gi, '[…]')
     .replace(/\bnew instruction/gi, '[…]')
  const reviewText = [...negativeReviews, ...positiveReviews]
    .map(r => `[${r.rating}★] ${sanitizeFree(r.text).slice(0, 180).trimEnd()}${r.text.length > 180 ? '…' : ''}`)
    .join('\n')

  const reviewsForSeo = reviews.map(r => ({ rating: r.rating, text: r.body }))
  const seoAnalysis = calculateSeoScore(reviewsForSeo, product.title)
  const negCount    = ctx.starCounts[1] + ctx.starCounts[2]
  const negPct      = ctx.totalReviewCount > 0
    ? Math.round((negCount / ctx.totalReviewCount) * 100)
    : 0

  let complaintsData: any = { complaints: [] }
  let strengthsData: any  = { strengths: [] }

  try {
    const raw = await callMistralLatest([
      {
        role: 'system' as const,
        content: FREE_PREVIEW_SYSTEM_PROMPT,
      },
      {
        role: 'user' as const,
        content: buildFreePreviewPrompt({
          productTitle: product.title,
          price:        product.price,
          reviewCount:  reviews.length,
          healthScore:  ctx.healthScore,
          reviewText,
        }),
      },
    ], 1400)

    const parsed = extractJson(raw) as any
    if (Array.isArray(parsed?.complaints)) complaintsData = { complaints: parsed.complaints.slice(0, 2) }
    if (Array.isArray(parsed?.strengths))  strengthsData  = { strengths:  parsed.strengths.slice(0, 1) }
  } catch (err) {
    console.warn('[FreePreview] parse failed, using empty preview:', err)
  }

  return {
    healthScore: ctx.healthScore,
    starBreakdown: {
      '1': ctx.starCounts[1],
      '2': ctx.starCounts[2],
      '3': ctx.starCounts[3],
      '4': ctx.starCounts[4],
      '5': ctx.starCounts[5],
    },
    complaints:      Array.isArray(complaintsData.complaints) ? complaintsData.complaints : [],
    strengths:       Array.isArray(strengthsData.strengths)   ? strengthsData.strengths   : [],
    improvements:    [],
    seo:             { score: seoAnalysis.score },
    marketingCopy:   [],
    reviewTemplates: [],
    careGuide:       null,
    quickWin:        null,
    topActions:      [],
    freeSummary:     `Health score ${ctx.healthScore}/100 is based on ${reviews.length} reviews, with ${negPct}% unhappy buyers. Free preview shows the top problems and one strength; fixes and full SEO unlock on paid plans.`,
    keyInsight:      'This is a preview of the biggest patterns in the reviews, not the full action plan.',
    summary:         `Health score ${ctx.healthScore}/100 reflects the main review patterns. The free preview shows the top complaints, one strength, and an SEO score.`,
    _sectionsReady:  ['complaints', 'strengths', 'seo', 'summary'],
    _cache: {
      reviewText,
      seoScore: seoAnalysis.score,
      negPct,
      listingDescription,
    },
    _isLimited: true,
  }
}

// applyPlanLimits lives in app/lib/plan-limits.ts (imported above)

// ── Main handler ──────────────────────────────────────────────

export async function POST(request: NextRequest) {
  // Cron bypass: internal re-analyze requests authenticate via X-Cron-Secret header
  // instead of a user session cookie. Must supply _cronUserId in the body.
  const cronCheck = verifyCronRequest(request)
  const isCronRequest = cronCheck.isCron
  if (cronCheck.isCron) {
    if (cronCheck.error) return cronCheck.error
  } else {
    const csrfError = checkCsrf(request)
    if (csrfError) return csrfError
  }

  const ip =
    request.headers.get('x-real-ip') ||
    request.headers.get('x-forwarded-for')?.split(',').at(0)?.trim() ||
    'unknown'

  const timeoutSignal = AbortSignal.timeout(270_000)

  let creditsDeducted    = false
  let creditsRefunded    = false
  let creditRefundUserId = ''
  let creditRefundAmount = 0

  const refundCredits = async () => {
    if (!creditsDeducted || !creditRefundUserId || creditsRefunded) return
    creditsRefunded = true // set BEFORE async call to prevent double-trigger races
    try {
      const supabase = await createClient()
      const { error } = await supabase.rpc('add_credits', {
        p_user_id: creditRefundUserId,
        p_amount:  creditRefundAmount,
      })
      if (error) {
        console.error('[Analyze] Credit refund RPC failed — MANUAL REVIEW NEEDED:', {
          userId: creditRefundUserId,
          amount: creditRefundAmount,
          error:  error.message,
        })
      } else {
        console.log(`[Analyze] Refunded ${creditRefundAmount} credits to ${creditRefundUserId}`)
      }
    } catch (e: any) {
      console.error('[Analyze] Credit refund threw — MANUAL REVIEW NEEDED:', {
        userId: creditRefundUserId,
        amount: creditRefundAmount,
        error:  e?.message,
      })
    }
  }

  try {
    const body               = await request.json()
    const rawUrl             = body?.productUrl
    const isReAnalyze        = body?.reAnalyze === true
    const reportType         = body?.reportType === 'competitor' ? 'competitor' : 'own'
    const ownReportId        = typeof body?.ownReportId === 'string' ? body.ownReportId : null
    const productDescription = typeof body?.productDescription === 'string'
      ? body.productDescription.trim().slice(0, 500).replace(/[<>]/g, '')
      : undefined

    if (!rawUrl || typeof rawUrl !== 'string') {
      return NextResponse.json({ error: 'Product URL or ASIN is required' }, { status: 400 })
    }

    const productUrl = sanitizeAmazonInput(rawUrl)
    if (!productUrl) {
      return NextResponse.json({ error: 'Please provide a valid Amazon product URL or ASIN (e.g. B073JYC4XM)' }, { status: 400 })
    }

    // Resolve user — either from session (normal) or from cron bypass (internal)
    let user: any = null
    let supabase: any
    if (isCronRequest) {
      const cronUserId = typeof body?._cronUserId === 'string' ? body._cronUserId : null
      if (!cronUserId) return NextResponse.json({ error: 'Missing _cronUserId' }, { status: 400 })
      const adminClient = createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
      )
      const { data: u } = await adminClient.auth.admin.getUserById(cronUserId)
      if (!u?.user) return NextResponse.json({ error: 'User not found' }, { status: 404 })
      user     = u.user
      supabase = adminClient
    } else {
      supabase = await createClient()
      const { data: { user: sessionUser } } = await supabase.auth.getUser()
      if (!sessionUser) return NextResponse.json({ error: 'Please log in first' }, { status: 401 })
      user = sessionUser
    }

    const { data: userData } = await supabase
      .from('users')
      .select('plan, is_admin, credits, competitor_analyses_used')
      .eq('id', user.id)
      .single()

    const isAdminUser              = userData?.is_admin === true
    const plan                     = userData?.plan    || 'free'
    const credits                  = userData?.credits ?? 0
    const competitorAnalysesUsed   = userData?.competitor_analyses_used ?? 0

    // Dedup: prevent same user+product within 60 seconds (double-click protection)
    {
      const sixtySecondsAgo = new Date(Date.now() - 60_000).toISOString()
      const { data: recentReport } = await supabase
        .from('reports')
        .select('id, status')
        .eq('user_id', user.id)
        .eq('product_url', productUrl)
        .gte('created_at', sixtySecondsAgo)
        .not('status', 'eq', 'failed')
        .limit(1)
        .maybeSingle()

      if (recentReport) {
        return NextResponse.json(
          { error: 'Analysis already in progress for this product. Please wait.', reportId: recentReport.id },
          { status: 409 },
        )
      }
    }

    if (!isAdminUser) {
      const limit = await enforceRateLimit(user.id, ip)
      if (!limit.allowed) {
        const resetIn = Math.ceil((limit.resetAt - Date.now()) / 60000)
        return NextResponse.json(
          { error: `Too many requests. Please wait ${resetIn} minute(s).` },
          { status: 429 },
        )
      }
    }

    const creditCost = reportType === 'competitor' ? CREDIT_COSTS.competitorAnalysis : CREDIT_COSTS.ownAnalysis

    // ── Competitor analysis gates ─────────────────────────────
    // Intentionally enforced for ALL competitor requests including re-analyze —
    // re-analyze must still consume a monthly competitor slot.
    if (!isAdminUser && reportType === 'competitor') {
      // Free plan: blocked entirely
      if (plan === 'free') {
        return NextResponse.json(
          { error: 'Competitor analysis is not available on the free plan. Upgrade to Growth to unlock it.', upgradeRequired: true, upgradePrompt: 'growth' },
          { status: 403 },
        )
      }

      const now        = new Date()
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

      if (plan === 'starter') {
        // Starter: 1 per month total
        const { count } = await supabase
          .from('competitor_usage')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .gte('created_at', monthStart)
        if ((count ?? 0) >= 1) {
          return NextResponse.json(
            { error: 'You\'ve used your 1 competitor analysis this month. Resets on the 1st. Upgrade to Growth for 3 per product per month.', upgradeRequired: true, upgradePrompt: 'growth' },
            { status: 403 },
          )
        }
      }

      if (plan === 'growth' || plan === 'pro') {
        const limit = plan === 'pro' ? 10 : 3
        let usageQuery = supabase
          .from('competitor_usage')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .gte('created_at', monthStart)

        // Per-product limit when ownReportId is provided; global monthly limit as fallback
        if (ownReportId) usageQuery = usageQuery.eq('own_report_id', ownReportId)

        const { count } = await usageQuery
        if ((count ?? 0) >= limit) {
          return NextResponse.json(
            {
              error: `You've used all ${limit} competitor analyses${ownReportId ? ' for this product' : ''} this month. Resets on the 1st.${plan === 'growth' ? ' Upgrade to Pro for 10 per product.' : ''}`,
              upgradeRequired: plan === 'growth',
              upgradePrompt: 'pro',
            },
            { status: 403 },
          )
        }
      }
    }

    // Check 7-day re-analyze cooldown BEFORE deducting credits
    if (isReAnalyze) {
      const { data: lastReport } = await supabase
        .from('reports')
        .select('last_analyzed_at')
        .eq('user_id', user.id)
        .eq('product_url', productUrl)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (lastReport?.last_analyzed_at) {
        const daysSince =
          (Date.now() - new Date(lastReport.last_analyzed_at).getTime()) / 86_400_000
        if (daysSince < 7) {
          return NextResponse.json(
            { error: `Re-analyze available in ${Math.ceil(7 - daysSince)} day(s).` },
            { status: 429 },
          )
        }
      }
    }

    if (!isAdminUser) {
      if (credits < creditCost) {
        return NextResponse.json(
          {
            error:           `Not enough credits. This analysis costs ${creditCost} credits.`,
            upgradeRequired: true,
          },
          { status: 403 },
        )
      }
      const { data: deducted, error: deductError } = await supabase.rpc('deduct_credits', {
        p_user_id: user.id,
        p_amount:  creditCost,
      })
      if (deductError) {
        console.error('[Analyze] Credit deduction failed:', deductError.message)
        return NextResponse.json(
          { error: 'Could not deduct credits. Please refresh and try again.', upgradeRequired: false },
          { status: 503 },
        )
      }
      if (!deducted) {
        return NextResponse.json(
          { error: 'Not enough credits.', upgradeRequired: true },
          { status: 403 },
        )
      }
      creditsDeducted    = true
      creditRefundUserId = user.id
      creditRefundAmount = creditCost

    }

    const { data: reportRow, error: reportError } = await supabase
      .from('reports')
      .insert({ user_id: user.id, product_url: productUrl, status: 'pending', report_type: reportType })
      .select()
      .single()

    if (reportError) throw reportError
    const reportId = reportRow.id

    try {
      resetSessionTokens()
      console.log(`[Pipeline] Starting Amazon scrape: ${productUrl} (plan: ${plan})`)

      const isFreeUser   = !isAdminUser && plan === 'free'
      const scrapeResult = await withRetry(
        () => isFreeUser ? scrapeAmazonFree(productUrl) : scrapeAmazon(productUrl, plan),
        2,
      )
      const { product: amazonProduct, reviews: rawReviews, qa } = scrapeResult

      const product = {
        title:         amazonProduct.title,
        price:         amazonProduct.price ?? 0,
        rating:        amazonProduct.averageRating,
        averageRating: amazonProduct.averageRating,
        asin:          amazonProduct.asin,
        marketplace:   amazonProduct.marketplace,
        category:      amazonProduct.category,
        mainImage:     amazonProduct.mainImage,
        reviewCount:   rawReviews.length,
      }

      const totalReviewCount = amazonProduct.totalReviews || rawReviews.length
      const unansweredQACount = qa.filter(q => q.answer === null).length

      if (rawReviews.length === 0) {
        await supabase.from('reports').update({ status: 'failed', product_name: amazonProduct.title || null }).eq('id', reportId)
        await refundCredits()
        const msg = scrapeResult.fromCache === false
          ? 'Our data provider is temporarily unavailable. Please try again in a few minutes. Your credits have been refunded.'
          : 'No reviews found for this product. Your credits have been refunded.'
        return NextResponse.json({ error: msg }, { status: 400 })
      }

      const ctx = calculateHealthScore(
        rawReviews,
        totalReviewCount,
        undefined,
        {
          imageCount:        amazonProduct.imageCount,
          videoCount:        amazonProduct.videoCount,
          hasAplus:          amazonProduct.hasAplus,
          bsr:               amazonProduct.bsr,
          bsrCategory:       amazonProduct.bsrCategory,
          recentSales:       amazonProduct.recentSales,
          unansweredQACount,
          ratingBreakdown:   amazonProduct.ratingBreakdown,
        },
      )
      console.log(
        `[HealthScore] ${ctx.healthScore} | Verified: ${ctx.verifiedHealthScore} | Fake flag: ${ctx.fakeReviewFlag} | Penalties: ${ctx.penaltyCount}`,
      )

      const analysis = (!isAdminUser && plan === 'free')
        ? await analyzeFreePreview(product, rawReviews, ctx, productDescription)
        : await analyzeProduct(product, rawReviews, ctx, productDescription)

      const { error: reportUpdateError } = await supabase
        .from('reports')
        .update({
          product_name:           product.title,
          health_score:           analysis.healthScore,
          total_reviews_analyzed: rawReviews.length,
          top_complaint:          analysis.complaints?.[0]?.title || null,
          top_strength:           analysis.strengths?.[0]?.title  || null,
          top_improvement:        analysis.improvements?.[0]?.title || null,
          competitors:            [],
          full_report:            (() => {
            return {
            ...analysis,
            asin:                amazonProduct.asin,
            marketplace:         amazonProduct.marketplace,
            productTitle:        amazonProduct.title,
            productImage:        amazonProduct.mainImage,
            imageCount:          amazonProduct.imageCount,
            videoCount:          amazonProduct.videoCount,
            hasAplus:            amazonProduct.hasAplus,
            bsr:                 amazonProduct.bsr,
            bsrCategory:         amazonProduct.bsrCategory,
            verifiedHealthScore: ctx.verifiedHealthScore,
            rawHealthScore:      ctx.rawHealthScore,
            fakeReviewFlag:      ctx.fakeReviewFlag,
            unansweredQAGaps:    qa.filter(q => q.answer === null).map(q => q.question).slice(0, 5),
            recentSales:         amazonProduct.recentSales,
            }
          })(),
          status:                 (!isAdminUser && plan === 'free') ? 'completed' : 'partial',
          last_analyzed_at:       new Date().toISOString(),
        })
        .eq('id', reportId)

      if (reportUpdateError) {
        console.error('[Analyze] Report update failed — credits refunded:', reportUpdateError.message)
        await refundCredits()
        return NextResponse.json({ error: 'Failed to save analysis. Your credits have been refunded.' }, { status: 500 })
      }

      await supabase
        .from('usage_logs')
        .insert({ user_id: user.id, report_id: reportId, tokens_used: getSessionTokens() })

      // Fire-and-forget cost log — never blocks or fails the analysis
      void Promise.resolve(
        createAdminClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!,
        )
          .from('usage_costs')
          .insert({
            user_id:          user.id,
            report_id:        reportId,
            asin:             scrapeResult.product.asin,
            scraper_provider: scrapeResult.scraperProvider ?? 'canopy',
            scraper_pages:    scrapeResult.scraperPages ?? 0,
            from_cache:       scrapeResult.fromCache ?? false,
            report_type:      reportType,
            credit_cost:      creditCost,
          }),
      ).catch(() => {})

      if (reportType === 'competitor') {
        await supabase.from('competitor_usage').insert({
          user_id:              user.id,
          own_report_id:        ownReportId ?? null,
          competitor_report_id: reportId,
        })
      }

      if (!isReAnalyze && user.email) {
        sendReportComplete({
          to:          user.email,
          productName: product.title,
          healthScore: analysis.healthScore,
          reportId,
        }).catch(e => console.error('[Analyze] Completion email failed:', e.message))
      }

      console.log(`[Pipeline] Analysis ready. Report: ${reportId}`)

      return NextResponse.json({
        success:        true,
        reportId,
        productName:    product.title,
        healthScore:    analysis.healthScore,
        totalReviewed:  rawReviews.length,
        plan,
        isLimited:      plan === 'free' && !isAdminUser,
        isPartial:      !(!isAdminUser && plan === 'free'),
        lowReviewCount: rawReviews.length < 30,
      })
    } catch (err: any) {
      console.error('[Pipeline] Error:', err.message)
      await supabase.from('reports').update({ status: 'failed' }).eq('id', reportId)
      await refundCredits()
      throw err
    }
  } catch (error: any) {
    if (error?.name === 'TimeoutError' || error?.code === 23) {
      console.error('[Analyze] Request timed out after 270s')
      await refundCredits()
      return NextResponse.json(
        { error: 'Analysis timed out — your credits have been refunded. Please try again.' },
        { status: 504 },
      )
    }
    console.error('[Analyze] Unhandled error:', error instanceof Error ? error.message : String(error))
    await refundCredits()
    return NextResponse.json(
      { error: 'Analysis failed — your credits have been refunded. Please try again.' },
      { status: 500 },
    )
  }
}