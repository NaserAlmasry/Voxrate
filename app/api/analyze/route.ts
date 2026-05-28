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
import { callMistral2411, callMistralLatest, resetSessionTokens, getSessionTokens, runWithSessionTokens, type Message } from '@/app/lib/mistral-fallback'
import { createClient } from '@/app/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import {
  calculateHealthScore,
  formatHealthScoreForPrompt,
  applyHardOverrides,
  validateSemanticConstraints,
} from '@/app/lib/health-score'
import { applyPlanLimits } from '@/app/lib/plan-limits'
import { enforceRateLimit, MAX_REQUESTS } from '@/app/lib/rate-limit'
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
import { escapePromptInput } from '@/app/lib/escape-prompt'
import { getComplaintCountGuidance } from '@/app/lib/complaint-guidance'
import { CREDIT_COSTS, PLAN_ANALYSES, REANALYZE_COOLDOWN_DAYS } from '@/app/lib/credit-costs'
import { sanitizeAmazonInput } from '@/app/lib/amazon-url'
import { verifyCronRequest } from '@/app/lib/cron-auth'
import {
  COMPLAINTS_SYSTEM_PROMPT,
  FREE_PREVIEW_SYSTEM_PROMPT,
  EXECUTIVE_SUMMARY_SYSTEM_PROMPT,
  buildComplaintsPrompt,
  buildComplaintsRetryPrompt,
  buildFreePreviewPrompt,
  buildExecutiveSummaryPrompt,
} from '@/app/lib/analysis-prompts'

export const maxDuration = 300

// ── Category benchmark lookup ─────────────────────────────────

const CATEGORY_BENCHMARKS: Record<string, number> = {
  electronics: 65, computers: 64, camera: 63, audio: 65,
  home: 62, kitchen: 62, garden: 63, furniture: 61,
  sports: 67, outdoors: 67, fitness: 66, exercise: 66,
  toys: 63, games: 64,
  beauty: 64, 'personal care': 63, cosmetics: 63,
  health: 66, grocery: 66, food: 66, gourmet: 66,
  clothing: 60, apparel: 60, shoes: 61, fashion: 60,
  baby: 65, tools: 61, hardware: 61,
  pet: 68, automotive: 62,
  books: 72, music: 70,
  office: 63, arts: 64,
}

function getCategoryBenchmark(category: string): number {
  const lower = (category || '').toLowerCase()
  for (const [key, val] of Object.entries(CATEGORY_BENCHMARKS)) {
    if (lower.includes(key)) return val
  }
  return 63
}

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
  product:              any,
  reviews:              AmazonReview[],
  ctx:                  ReturnType<typeof calculateHealthScore>,
  listingDescription?:  string,
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
  const fiveStarFromMixed = sampledReviews.filter(r => r.rating === 5).slice(0, 30)

  // Feature 5: Sort negative reviews by helpful count descending (most upvoted first)
  // Feature 8: Prepend review title to body for better pattern detection
  const negReviewsWithMeta = reviews
    .filter(r => r.rating <= 2)
    .sort((a, b) => (b.helpful || 0) - (a.helpful || 0))
    .slice(0, 50)

  const negReviewText = (negReviewsWithMeta.length > 0 ? negReviewsWithMeta : reviews.slice(0, 20))
    .map(r => {
      const titlePart = r.title ? `"${r.title}" — ` : ''
      return `[${r.rating}★]${r.helpful > 0 ? ` [${r.helpful} helpful]` : ''} ${titlePart}${sanitizeReview(r.body).slice(0, 200).trimEnd()}` +
        (r.body.length > 200 ? '…' : '')
    }).join('\n')

  const posReviewText = (positiveReviews.length > 0 ? positiveReviews : sampledReviews.slice(0, 25))
    .map(r =>
      `[${r.rating}★] ${sanitizeReview(r.text).slice(0, 200).trimEnd()}` +
      (r.text.length > 200 ? '…' : ''),
    ).join('\n')

  const fiveStarText = (fiveStarFromMixed.length > 0 ? fiveStarFromMixed : positiveReviews.slice(0, 10))
    .map(r =>
      `[5★] ${sanitizeReview(r.text).slice(0, 180).trimEnd()}` +
      (r.text.length > 180 ? '…' : ''),
    ).join('\n')

  console.log(
    `[Parallel] Review splits — neg: ${negativeReviews.length}, ` +
    `pos: ${positiveReviews.length}, 5★: ${fiveStarFromMixed.length}`,
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
  const domainKnowledgeSafe = escapePromptInput(domainKnowledge)
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

  const contextBlock = `PRODUCT: <product_title>${escapePromptInput(product.title || '')}</product_title>
ASIN: ${escapePromptInput(product.asin || '')}
MARKETPLACE: ${escapePromptInput(product.marketplace || 'amazon.com')}
PRICE: $${product.price || 'N/A'}
RATING: ${product.averageRating || product.rating}/5
TOTAL RATINGS: ${ctx.totalReviewCount.toLocaleString()}
${bsrLine}
STAR BREAKDOWN: ${starPctLine}
REVIEWS ANALYZED: ${reviews.length}${descriptionLine}

${healthBlock}

${listingIntelligence}

${patterns.promptSummary}

PRE-DETECTED COMPLAINT PATTERNS (from ALL ${reviews.length} reviews — use these counts as ground truth for frequency):
${(patterns.complaintClusters || []).slice(0, 8).map((c: any) => `- "${c.phrase}": ${c.count} reviews (${c.pct}% of total), ${c.verified ?? 0} verified buyers`).join('\n')}

PRE-DETECTED STRENGTH PATTERNS:
${(patterns.strengthClusters || []).slice(0, 5).map((s: any) => `- "${s.phrase}": ${s.count} reviews (${s.pct}%)`).join('\n')}

VERBATIM 5-STAR QUOTES (copy these exactly for marketing copy):
${(patterns.bestVerbatimQuotes || []).slice(0, 5).join('\n')}

HELPFUL VOTE SIGNAL: Reviews are sorted by helpful votes (most-upvoted first). A complaint appearing in highly-upvoted reviews (shown as [X helpful]) carries stronger signal than one in zero-helpful reviews.

${domainKnowledgeSafe}

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

  // Feature 5: Enrich complaints with topHelpful (max helpful vote from reviews mentioning that cluster phrase)
  if (Array.isArray(complaintsData.complaints)) {
    complaintsData.complaints = complaintsData.complaints.map((complaint: any) => {
      const matchingCluster = (patterns.complaintClusters || []).find(
        (c: any) => c.phrase && complaint.title &&
          (complaint.title.toLowerCase().includes(c.phrase.toLowerCase()) ||
           c.phrase.toLowerCase().includes(complaint.title.toLowerCase().split(' ')[0]))
      )
      if (matchingCluster) {
        // Find max helpful vote from reviews mentioning this phrase
        const topHelpful = reviews
          .filter(r => r.body.toLowerCase().includes(matchingCluster.phrase.toLowerCase()))
          .reduce((max, r) => Math.max(max, r.helpful || 0), 0)
        return { ...complaint, topHelpful: topHelpful > 0 ? topHelpful : undefined }
      }
      return complaint
    })
  }

  // ── Call 2: EXECUTIVE SUMMARY + ACTION PLAN ──────────────────
  let executiveSummary = ''
  let actionPlan: any[] = []
  try {
    const summaryRaw = await callMistralLatest([
      { role: 'system' as const, content: EXECUTIVE_SUMMARY_SYSTEM_PROMPT },
      {
        role: 'user' as const,
        content: buildExecutiveSummaryPrompt({
          productTitle:      product.title,
          healthScore:       ctx.healthScore,
          categoryBenchmark: getCategoryBenchmark(product.category || ''),
          negPct,
          seoScore:          seoAnalysis.score,
          topComplaints:     (complaintsData.complaints || []).slice(0, 3).map((c: any) => ({ title: c.title, severity: c.severity })),
          reviewCount:       reviews.length,
        }),
      },
    ], 900)
    const parsed = extractJson(summaryRaw) as any
    if (typeof parsed?.executive_summary === 'string' && parsed.executive_summary.length > 20) {
      executiveSummary = parsed.executive_summary
    }
    if (Array.isArray(parsed?.action_plan)) {
      actionPlan = parsed.action_plan.slice(0, 3)
    }
    console.log(`[Summary] Executive summary generated — ${executiveSummary.length} chars, ${actionPlan.length} actions`)
  } catch (e) {
    console.warn('[Summary] Executive summary generation failed:', e)
  }

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
    topActions:      actionPlan,
    freeSummary:     '',
    keyInsight:      '',
    summary:         executiveSummary,
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
    categoryBenchmark: getCategoryBenchmark(product.category || ''),
    // Feature 6: Vine/unverified breakdown
    vineReviews:       ctx.vineReviews,
    unverifiedReviews: ctx.unverifiedReviews,
    verifiedReviews:   ctx.verifiedReviews,
    // Feature 7: SEO reasoning
    seoReasoning:      seoAnalysis.reasoning,
    _sectionsReady: ['complaints', 'summary', 'topActions'],
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

  let analysisDeducted    = false
  let analysisRefunded    = false
  let analysisRefundUserId = ''
  let analysisRefundType: 'own' | 'competitor' = 'own'

  const refundAnalysis = async () => {
    if (!analysisDeducted || !analysisRefundUserId || analysisRefunded) return
    analysisRefunded = true
    try {
      const adminSupabase = createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
      )
      const rpc = analysisRefundType === 'competitor' ? 'refund_competitor_analysis' : 'refund_own_analysis'
      const { error } = await adminSupabase.rpc(rpc, { p_user_id: analysisRefundUserId })
      if (error) {
        console.error('[Analyze] Analysis refund RPC failed — MANUAL REVIEW NEEDED:', {
          userId: analysisRefundUserId, type: analysisRefundType, error: error.message,
        })
      } else {
        console.log(`[Analyze] Refunded 1 ${analysisRefundType} analysis to ${analysisRefundUserId}`)
      }
    } catch (e: any) {
      console.error('[Analyze] Analysis refund threw — MANUAL REVIEW NEEDED:', {
        userId: analysisRefundUserId, type: analysisRefundType, error: e?.message,
      })
    }
  }

  try {
    const body               = await request.json()
    const rawUrl             = body?.productUrl
    const isReAnalyze        = body?.reAnalyze === true
    const emergencyReanalyze = body?.emergencyReanalyze === true
    const reportType         = body?.reportType === 'competitor' ? 'competitor' : 'own'
    const ownReportId        = typeof body?.ownReportId === 'string' ? body.ownReportId : null
    const productDescription = typeof body?.productDescription === 'string'
      ? escapePromptInput(sanitizeReview(body.productDescription.trim().slice(0, 500)))
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
      .select('plan, is_admin, own_analyses_remaining, competitor_analyses_remaining, reanalyze_overrides')
      .eq('id', user.id)
      .single()

    const isAdminUser                  = userData?.is_admin === true
    const plan                         = userData?.plan    || 'free'
    const ownRemaining                 = userData?.own_analyses_remaining ?? 0
    const competitorRemaining          = userData?.competitor_analyses_remaining ?? 0
    const reanalyzeOverrides           = userData?.reanalyze_overrides ?? 0

    // Dedup: prevent same user+product within 60 seconds (double-click protection)
    // Normalize to ASIN so that full URL and bare ASIN for the same product match
    const asinMatch = productUrl.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/i) || productUrl.match(/^([A-Z0-9]{10})$/i)
    const dedupeKey = asinMatch ? asinMatch[1].toUpperCase() : productUrl
    {
      const sixtySecondsAgo = new Date(Date.now() - 60_000).toISOString()
      const { data: recentReport } = await supabase
        .from('reports')
        .select('id, status')
        .eq('user_id', user.id)
        .ilike('product_url', `%${dedupeKey}%`)
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

    {
      const adminMultiplier = isAdminUser ? 10 : 1
      const limit = await enforceRateLimit(user.id, ip, MAX_REQUESTS * adminMultiplier)
      if (!limit.allowed) {
        const resetIn = Math.ceil((limit.resetAt - Date.now()) / 60000)
        return NextResponse.json(
          { error: `Too many requests. Please wait ${resetIn} minute(s).` },
          { status: 429 },
        )
      }
    }

    // ── Competitor analysis gates ─────────────────────────────
    if (!isAdminUser && reportType === 'competitor') {
      if (plan === 'free') {
        return NextResponse.json(
          { error: 'Competitor analysis is not available on the free plan. Upgrade to Starter to unlock it.', upgradeRequired: true, upgradePrompt: 'starter' },
          { status: 403 },
        )
      }
      if (competitorRemaining <= 0) {
        const limits = PLAN_ANALYSES[plan as keyof typeof PLAN_ANALYSES] ?? PLAN_ANALYSES.free
        return NextResponse.json(
          {
            error: `You've used all ${limits.competitor} competitor analyses this month. Rolls over on the 1st.${plan !== 'pro' ? ' Upgrade for more.' : ''}`,
            upgradeRequired: plan !== 'pro',
            upgradePrompt: plan === 'starter' ? 'growth' : 'pro',
          },
          { status: 403 },
        )
      }
    }

    // ── Re-analyze cooldown (plan-aware) ──────────────────────
    if (isReAnalyze && !isAdminUser) {
      const cooldownDays = REANALYZE_COOLDOWN_DAYS[plan] ?? 7
      if (cooldownDays > 0) {
        // BUG 6 fix: query cooldown by ASIN substring instead of exact URL match
        // to prevent bypass via URL variation (e.g. with/without query params)
        const cooldownAsinMatch = productUrl.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/i) || productUrl.match(/^([A-Z0-9]{10})$/i)
        const cooldownAsin = cooldownAsinMatch ? cooldownAsinMatch[1].toUpperCase() : productUrl
        const { data: lastReport } = await supabase
          .from('reports')
          .select('last_analyzed_at')
          .eq('user_id', user.id)
          .ilike('product_url', `%${cooldownAsin}%`)
          .eq('status', 'completed')
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

        if (lastReport?.last_analyzed_at) {
          const daysSince = (Date.now() - new Date(lastReport.last_analyzed_at).getTime()) / 86_400_000
          if (daysSince < cooldownDays) {
            if (emergencyReanalyze && reanalyzeOverrides > 0) {
              // Burn one emergency override — non-fatal if it fails
              await supabase
                .from('users')
                .update({ reanalyze_overrides: reanalyzeOverrides - 1 })
                .eq('id', user.id)
                .catch((e: any) => console.warn('[Analyze] override decrement failed:', e?.message))
            } else {
              return NextResponse.json(
                {
                  error: `Re-analyze available in ${Math.ceil(cooldownDays - daysSince)} day(s).${plan !== 'pro' ? ' Pro plan removes this cooldown.' : ''}`,
                  cooldownDaysLeft: Math.ceil(cooldownDays - daysSince),
                  hasEmergencyOverride: reanalyzeOverrides > 0,
                },
                { status: 429 },
              )
            }
          }
        }
      }
    }

    if (!isAdminUser) {
      const isCompetitor = reportType === 'competitor'

      // BUG 3 fix: removed pre-read balance guard — rely solely on the RPC returning false
      // when balance is 0. The RPC is the single source of truth (prevents double-spend race).

      const rpc = reportType === 'competitor' ? 'deduct_competitor_analysis' : 'deduct_own_analysis'
      const { data: deducted, error: deductError } = await supabase.rpc(rpc, { p_user_id: user.id })
      if (deductError) {
        console.error('[Analyze] Analysis deduction failed:', deductError.message)
        return NextResponse.json(
          { error: 'Could not deduct analysis. Please refresh and try again.', upgradeRequired: false },
          { status: 503 },
        )
      }
      if (!deducted) {
        const isCompetitor = reportType === 'competitor'
        const limits = PLAN_ANALYSES[plan as keyof typeof PLAN_ANALYSES] ?? PLAN_ANALYSES.free
        const monthly = isCompetitor ? limits.competitor : limits.own
        return NextResponse.json(
          {
            error: `You've used all ${monthly} ${isCompetitor ? 'competitor' : 'own'} analyses this month. Rolls over on the 1st.`,
            upgradeRequired: true,
          },
          { status: 403 },
        )
      }
      analysisDeducted     = true
      analysisRefundUserId = user.id
      analysisRefundType   = reportType as 'own' | 'competitor'

    }

    const { data: reportRow, error: reportError } = await supabase
      .from('reports')
      .insert({ user_id: user.id, product_url: productUrl, status: 'pending', report_type: reportType })
      .select()
      .single()

    if (reportError) throw new Error(reportError.message)
    const reportId = reportRow.id

    try {
      return await runWithSessionTokens(async () => {
      console.log(`[Pipeline] Starting Amazon scrape: ${productUrl} (plan: ${plan})`)

      const isFreeUser   = !isAdminUser && plan === 'free'
      let scrapeResult
      try {
        scrapeResult = await withRetry(
          () => isFreeUser ? scrapeAmazonFree(productUrl) : scrapeAmazon(productUrl, plan, user.id),
          2,
        )
      } catch (err: any) {
        if (err?.message?.startsWith('extension_cooldown:')) {
          const waitSec = parseInt(err.message.split(':')[1] ?? '60')
          const mins = Math.ceil(waitSec / 60)
          await refundAnalysis()
          return NextResponse.json({
            error: `Your extension is cooling down to protect your Amazon account. Please wait ${mins > 1 ? `${mins} minutes` : `${waitSec} seconds`} before starting the next analysis.`,
            extensionCooldown: true,
            waitSeconds: waitSec,
          }, { status: 429 })
        }
        throw err
      }
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
        await refundAnalysis()
        const msg = scrapeResult.fromCache === false
          ? 'Our data provider is temporarily unavailable. Please try again in a few minutes. Your analysis has been refunded.'
          : 'No reviews found for this product. Your analysis has been refunded.'
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
            verifiedHealthScore:  ctx.verifiedHealthScore,
            rawHealthScore:       ctx.rawHealthScore,
            fakeReviewFlag:       ctx.fakeReviewFlag,
            categoryBenchmark:    getCategoryBenchmark(amazonProduct.category || ''),
            unansweredQAGaps:    qa.filter(q => q.answer === null).map(q => q.question).slice(0, 5),
            recentSales:         amazonProduct.recentSales,
            // Feature 6: Vine/unverified breakdown
            vineReviews:         ctx.vineReviews,
            unverifiedReviews:   ctx.unverifiedReviews,
            verifiedReviews:     ctx.verifiedReviews,
            // Feature 7: SEO reasoning (from analysis object — already set in analyzeProduct)
            seoReasoning:        analysis.seoReasoning ?? analysis._cache?.seoReasoning ?? null,
            }
          })(),
          status:                 (!isAdminUser && plan === 'free') ? 'completed' : 'partial',
          last_analyzed_at:       new Date().toISOString(),
        })
        .eq('id', reportId)

      if (reportUpdateError) {
        console.error('[Analyze] Report update failed — analysis refunded:', reportUpdateError.message)
        await refundAnalysis()
        return NextResponse.json({ error: 'Failed to save analysis. Your analysis has been refunded.' }, { status: 500 })
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
            credit_cost: 1,
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
        isPartial:      !isAdminUser && plan !== 'free',
        lowReviewCount: rawReviews.length < 30,
      })
      }) // end runWithSessionTokens
    } catch (err: any) {
      console.error('[Pipeline] Error:', err.message)
      await supabase.from('reports').update({ status: 'failed' }).eq('id', reportId)
      await refundAnalysis()
      throw err
    }
  } catch (error: any) {
    if (error?.name === 'TimeoutError' || error?.code === 23) {
      console.error('[Analyze] Request timed out after 270s')
      await refundAnalysis()
      return NextResponse.json(
        { error: 'Analysis timed out — your analysis has been refunded. Please try again.' },
        { status: 504 },
      )
    }
    console.error('[Analyze] Unhandled error:', error instanceof Error ? error.message : String(error))
    await refundAnalysis()
    return NextResponse.json(
      { error: 'Analysis failed — your analysis has been refunded. Please try again.' },
      { status: 500 },
    )
  }
}