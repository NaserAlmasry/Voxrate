// ============================================================
// app/api/analyze-csv/route.ts
//
// CHANGES IN THIS VERSION — model routing only, prompts untouched:
//
//  [ROUTING-1] Call 1 (Complaints):    llama-3.3-70b-versatile — unchanged
//  [ROUTING-2] Call 2 (Strengths):     llama-3.3-70b-versatile — unchanged
//  [ROUTING-3] Call 3 (SEO+Marketing): llama-3.1-8b-instant    — was 70b
//              max_tokens: 1200 → 800
//              fiveStarText: 20 reviews → 10 reviews
//              sleep before: 35s → 3s  (8b has separate TPM bucket)
//  [ROUTING-4] Call 4 (Summary):       llama-3.1-8b-instant    — was 70b
//              max_tokens: 1000 → 600
//              sleep before: 35s → 3s
//  [ROUTING-5] Free preview:           llama-3.1-8b-instant    — unchanged
//  [ROUTING-6] callGroq() split into callGroq70b() and callGroq8b()
//
//  Speed: CSV analyses were ~3.5 minutes (including 70s of sleep).
//         Now ~2 minutes (sleeps before 8b calls reduced to 3s each).
//
//  Token improvement: ~20-30% fewer tokens per paid CSV analysis.
//  The 35s sleeps existed to avoid 70b TPM limits.
//  8b has its own much higher TPM limit — 3s is sufficient.
//
//  Prompts: NOT changed.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import Groq from 'groq-sdk'
import { createClient } from '@/app/lib/supabase/server'
import {
  calculateHealthScore,
  formatHealthScoreForPrompt,
  applyHardOverrides,
  validateSemanticConstraints,
} from '@/app/lib/health-score'
import { enforceRateLimit } from '@/app/lib/rate-limit'
import { checkCsrf } from '@/app/lib/csrf'
import { getClientIp } from '@/app/lib/ip'
import {
  generateDomainAndSeo,
  extractWorstReviews,
  extractBestReviews,
} from '@/app/lib/domain-knowledge'
import { extractPatterns, buildSmartSample } from '@/app/lib/pattern-extractor'
import { calculateSeoScore } from '@/app/lib/seo-scorer'
import { sendReportComplete } from '@/app/lib/email'
import { extractJson } from '@/app/lib/extract-json'

export const maxDuration = 180

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

// ── Model routing ─────────────────────────────────────────────
const MODEL_70B = 'llama-3.3-70b-versatile'  // Calls 1+2: complex reasoning
const MODEL_8B  = 'llama-3.1-8b-instant'     // Calls 3+4: extraction/formatting


const MAX_REVIEW_CHARS   = 300
const MAX_PROMPT_REVIEWS = 280

// Sleep durations by model — 8b has separate, higher TPM bucket
const SLEEP_AFTER_70B = 35_000  // 35s between 70b calls (unchanged)
const SLEEP_AFTER_8B  =  3_000  // 3s between 8b calls (was 35s — unnecessary)

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
const MAX_GROQ_RETRY_WAIT_MS = 30_000 // hard clamp — never sleep more than 30s

function parseGroqRetrySeconds(message: string): number | null {
  const phrase = message.match(/try again in\s+([^\.\n"]+(?:\.\d+)?s?)/i)?.[1]
  if (!phrase) return null

  const hours   = phrase.match(/(\d+(?:\.\d+)?)h/i)
  const minutes = phrase.match(/(\d+(?:\.\d+)?)m/i)
  const seconds = phrase.match(/(\d+(?:\.\d+)?)s/i)

  const total =
    (hours   ? Number(hours[1])   * 3600 : 0) +
    (minutes ? Number(minutes[1]) * 60   : 0) +
    (seconds ? Number(seconds[1])        : 0)

  return total > 0 ? Math.ceil(total) : null
}

function formatRetryTime(seconds: number | null): string {
  if (!seconds) return 'a few minutes'
  const hours   = Math.floor(seconds / 3600)
  const minutes = Math.ceil((seconds % 3600) / 60)
  if (hours > 0 && minutes > 0) return `${hours} hour${hours === 1 ? '' : 's'} ${minutes} minute${minutes === 1 ? '' : 's'}`
  if (hours > 0) return `${hours} hour${hours === 1 ? '' : 's'}`
  return `${Math.max(1, minutes)} minute${minutes === 1 ? '' : 's'}`
}

function getGroqRateLimitInfo(error: any): { isRateLimit: boolean; retryAfterSeconds: number | null } {
  const message     = String(error?.message || error)
  const isRateLimit = error?.status === 429 || message.includes('rate_limit_exceeded') || message.includes('Rate limit reached')
  return {
    isRateLimit,
    retryAfterSeconds: isRateLimit ? parseGroqRetrySeconds(message) : null,
  }
}

function friendlyGroqLimitMessage(retryAfterSeconds: number | null): string {
  return `Analysis capacity is temporarily full. Please try again in ${formatRetryTime(retryAfterSeconds)}.`
}

// ── CSV parser ────────────────────────────────────────────────

function parseCSV(
  csvText: string,
): Array<{ rating: number; text: string; date: string }> {
  const lines = csvText.trim().replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  if (lines.length < 2) throw new Error('CSV file is empty or has no reviews')

  const header = lines[0].toLowerCase().replace(/"/g, '').replace(/\r/g, '')
  const cols   = header.split(',').map((c) => c.trim())

  const ratingIdx = cols.findIndex(
    (c) => c.includes('rating') || c.includes('stars') || c.includes('score'),
  )
  const reviewIdx = cols.findIndex(
    (c) =>
      c.includes('review') ||
      c.includes('text')   ||
      c.includes('comment')||
      c.includes('body')   ||
      c.includes('content'),
  )
  const dateIdx = cols.findIndex(
    (c) => c.includes('date') || c.includes('time') || c.includes('created'),
  )

  if (reviewIdx === -1) {
    throw new Error('CSV must have a column named "review", "text", "comment", or "body"')
  }

  const reviews: Array<{ rating: number; text: string; date: string }> = []

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    const fields: string[] = []
    let current  = ''
    let inQuotes = false
    for (const char of line) {
      if (char === '"') { inQuotes = !inQuotes; continue }
      if (char === ',' && !inQuotes) { fields.push(current.trim()); current = ''; continue }
      current += char
    }
    fields.push(current.trim())

    let reviewText = fields[reviewIdx]?.replace(/^"|"$/g, '').trim()
    if (!reviewText || reviewText.length < 5) continue
    // Defuse CSV formula injection — strip leading formula chars
    if (/^[=+\-@\t\r]/.test(reviewText)) reviewText = reviewText.replace(/^[=+\-@\t\r]+/, '')

    const ratingRaw = ratingIdx !== -1
      ? fields[ratingIdx]?.replace(/^"|"$/g, '').trim()
      : '5'
    const rating = Math.min(5, Math.max(1, parseInt(ratingRaw) || 5))
    const date   = dateIdx !== -1
      ? fields[dateIdx]?.replace(/^"|"$/g, '').trim()
      : ''

    reviews.push({ rating, text: reviewText, date })
  }

  if (reviews.length === 0) throw new Error('No valid reviews found in CSV')
  return reviews
}

// ── Groq callers — one per model tier ────────────────────────

async function callGroq70b(
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  maxTokens: number,
): Promise<string> {
  let lastError: unknown

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await groq.chat.completions.create({
        model:       MODEL_70B,
        max_tokens:  maxTokens,
        temperature: 0.1,
        messages,
      })
      const usage = response.usage
      if (usage) {
        console.log(`[Groq-70b] prompt: ${usage.prompt_tokens}, completion: ${usage.completion_tokens}, total: ${usage.total_tokens}`)
      }
      return response.choices[0].message.content || ''
    } catch (error: any) {
      lastError = error
      const limitInfo = getGroqRateLimitInfo(error)
      const parsedMs  = limitInfo.retryAfterSeconds ? limitInfo.retryAfterSeconds * 1000 : 35_000
      const retryMs   = Math.min(parsedMs, MAX_GROQ_RETRY_WAIT_MS)
      const canRetry  = limitInfo.isRateLimit
      if (!canRetry || attempt === 2) break
      console.warn(`[Groq-70b] Rate limit hit. Retrying in ${retryMs}ms...`)
      await sleep(retryMs + 1000)
    }
  }

  throw lastError
}

async function callGroq8b(
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  maxTokens: number,
): Promise<string> {
  let lastError: unknown

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await groq.chat.completions.create({
        model:       MODEL_8B,
        max_tokens:  maxTokens,
        temperature: 0.1,
        messages,
      })
      const usage = response.usage
      if (usage) {
        console.log(`[Groq-8b] prompt: ${usage.prompt_tokens}, completion: ${usage.completion_tokens}, total: ${usage.total_tokens}`)
      }
      return response.choices[0].message.content || ''
    } catch (error: any) {
      lastError = error
      const limitInfo = getGroqRateLimitInfo(error)
      const parsedMs  = limitInfo.retryAfterSeconds ? limitInfo.retryAfterSeconds * 1000 : 5_000
      const retryMs   = Math.min(parsedMs, MAX_GROQ_RETRY_WAIT_MS)
      const canRetry  = limitInfo.isRateLimit
      if (!canRetry || attempt === 2) break
      console.warn(`[Groq-8b] Rate limit hit. Retrying in ${retryMs}ms...`)
      await sleep(retryMs + 1000)
    }
  }

  throw lastError
}

// ── Complaint count guidance ──────────────────────────────────

function getComplaintCountGuidance(reviewCount: number, negCount: number, sampled?: number): string {
  const sampledNote = sampled ? ` (${sampled} sampled)` : ''
  const negNote     = negCount > 0 ? ` with ${negCount} negative reviews (1★–2★)` : ''
  const minFromNeg  = Math.max(2, Math.floor(negCount / 8))

  if (reviewCount >= 500) {
    const min = Math.max(6, minFromNeg)
    return `REVIEW COUNT: ${reviewCount}${sampledNote}${negNote}.
MANDATORY COMPLAINT COUNT: ${min}–9 distinct complaints. You MUST reach ${min} before stopping.
SEPARATION RULE: "handle cracks" and "handle wobbles" are TWO complaints, not one. Each physical symptom reviewers describe separately = its own entry.
Do NOT write "durability issues" — write the exact symptom reviewers described.`
  }
  if (reviewCount >= 200) {
    const min = Math.max(5, minFromNeg)
    return `REVIEW COUNT: ${reviewCount}${sampledNote}${negNote}.
MANDATORY COMPLAINT COUNT: ${min}–7 distinct complaints. Do NOT stop before ${min}.
SEPARATION RULE: Do not merge problems that affect different parts of the product or happen at different times. Each = its own entry.
Do NOT write "quality issues" or "durability problems" — name the specific symptom.`
  }
  if (reviewCount >= 100) {
    const min = Math.max(4, minFromNeg)
    return `REVIEW COUNT: ${reviewCount}${sampledNote}${negNote}.
MANDATORY COMPLAINT COUNT: ${min}–6 distinct complaints.
SEPARATION RULE: If reviewers complain about two different things (e.g. blade and handle), those are TWO complaints.
Write the exact words reviewers used to describe each problem — do not abstract or generalize.`
  }
  if (reviewCount >= 50) {
    const min = Math.max(3, minFromNeg)
    return `REVIEW COUNT: ${reviewCount}${sampledNote}${negNote}.
MANDATORY COMPLAINT COUNT: ${min}–5 distinct complaints.
Read every 1★ and 2★ review. Count how many distinct physical symptoms or failure modes appear. Each one = its own complaint entry.
If reviewers mention rust AND cracking AND wrong color, those are THREE complaints.`
  }
  const min = Math.max(2, minFromNeg)
  return `REVIEW COUNT: ${reviewCount}${sampledNote}${negNote}.
MANDATORY COMPLAINT COUNT: at least ${min} complaints.
Read every negative review individually. List every distinct problem mentioned — do not merge separate issues into one.
Even if all relate to the handle, "cracks at the pin" and "loose after a month" are DIFFERENT complaints.`
}

// ── Output guardrails ─────────────────────────────────────────

const BANNED_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\bto address this issue,?\s*/gi, ''],
  [/\bto address this,?\s*/gi, ''],
  [/\bconsider adding\b/gi, 'add'],
  [/\bconsider using\b/gi, 'use'],
  [/\bconsider updating\b/gi, 'rewrite'],
  [/\bconsider\b/gi, 'use'],
  [/\bthis will help to\b/gi, ''],
  [/\bthis can help to\b/gi, ''],
  [/\bcan help to\b/gi, ''],
  [/\bmay improve\b/gi, 'changes'],
  [/\bcould involve\b/gi, 'requires'],
  [/\bimprove durability\b/gi, 'fix the reviewed failure point'],
  [/\benhancing the product'?s durability and construction quality\b/gi, 'reinforcing the reviewed failure points'],
  [/\bproduct'?s durability and construction quality\b/gi, 'reviewed failure points'],
  [/\bdurability and construction quality\b/gi, 'reviewed failure points'],
  [/\bdurability\b/gi, 'reviewed wear pattern'],
  [/\bdurable enough\b/gi, 'holding up under the reviewed use pattern'],
  [/\bmore durable thread\b/gi, 'bonded nylon thread with a shorter stitch length'],
  [/\benhance quality\b/gi, 'fix the reviewed defect'],
  [/\bimprove quality\b/gi, 'fix the reviewed defect'],
  [/\bbetter materials\b/gi, 'materials matched to the reviewed use case'],
  [/\bstronger construction\b/gi, 'construction matched to the reviewed failure point'],
  [/\bimprove craftsmanship\b/gi, 'fix the reviewed workmanship defect'],
  [/\breduce returns\b/gi, 'reduce repeat reports of this issue'],
  [/\bimprove customer satisfaction\b/gi, 'match the buyer expectation described in reviews'],
  [/\bincrease customer satisfaction\b/gi, 'match the buyer expectation described in reviews'],
  [/\bcustomers will appreciate\b/gi, 'reviewers asked for'],
  [/\bbuyers expect\b/gi, 'reviewers expected'],
  [/\benhance the experience\b/gi, 'match the reviewed expectation'],
  [/\btackle this problem\b/gi, 'fix this reviewed problem'],
  [/\baddress this issue\b/gi, 'fix this reviewed issue'],
  [/\bupdate the listing description\b/gi, 'add exact expectation details to the listing'],
  [/\bupdate the listing to accurately describe\b/gi, 'add exact expectation details to the listing for'],
  [/\bupdate the listing\b/gi, 'add exact expectation details to the listing'],
  [/\bupdate listing description\b/gi, 'add exact expectation details to the listing'],
  [/\bupdate listing\b/gi, 'add exact expectation details to the listing'],
  [/\baccurately describe\b/gi, 'state the exact reviewed details for'],
  [/\bcustomer expectations\b/gi, 'the reviewed buyer expectation'],
  [/\bcustomer expectation\b/gi, 'reviewed buyer expectation'],
  [/\bcustomer loyalty\b/gi, 'repeat purchases from buyers with the same expectation'],
  [/\bloyalty\b/gi, 'repeat purchases'],
  [/\boverall customer experience\b/gi, 'reviewed buyer experience'],
  [/\brepeat business\b/gi, 'repeat purchases'],
]

function cleanModelText(value: string): string {
  return BANNED_REPLACEMENTS.reduce(
    (text, [pattern, replacement]) => text.replace(pattern, replacement),
    value,
  )
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([.,;:])/g, '$1')
    .trim()
}

function cleanModelOutput(value: unknown): unknown {
  if (typeof value === 'string') return cleanModelText(value)
  if (Array.isArray(value)) return value.map(cleanModelOutput)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, cleanModelOutput(item)]),
    )
  }
  return value
}

function numberFromFrequency(value: unknown): number {
  const match = String(value || '').match(/\d+/)
  return match ? Number(match[0]) : 0
}

function complaintSignature(complaint: any): string {
  const text = [
    complaint?.title,
    complaint?.shortDescription,
    complaint?.description,
    complaint?.quote,
  ].join(' ').toLowerCase()

  if (/(packag|padding|bubble|wrap|box|shipping|transit|arriv)/.test(text) &&
      /(crack|broken|damage|glass|jar)/.test(text)) return 'shipping-glass-damage'
  if (/(tunnel|melt pool|unmelted wax|wick)/.test(text)) return 'candle-tunneling'
  if (/(weak|faint|no scent|scent throw|fragrance)/.test(text)) return 'scent-throw'
  if (/(leak|spill|melted|wax spill)/.test(text)) return 'wax-leak'
  if (/(wrong color|different color|color)/.test(text)) return 'color-mismatch'
  if (/(small|size|smaller|tiny)/.test(text)) return 'size-mismatch'

  return String(complaint?.title || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

function mergeDuplicateComplaints(complaints: any[]): any[] {
  const bySignature = new Map<string, any>()

  for (const complaint of complaints) {
    const signature = complaintSignature(complaint)
    const existing  = bySignature.get(signature)
    if (!existing) { bySignature.set(signature, complaint); continue }

    const existingCount = numberFromFrequency(existing.frequency || existing.revenueImpact)
    const nextCount     = numberFromFrequency(complaint.frequency || complaint.revenueImpact)
    const winner        = nextCount > existingCount ? complaint : existing
    const loser         = winner === complaint ? existing : complaint

    winner.fixes = [
      ...(Array.isArray(winner.fixes) ? winner.fixes : []),
      ...(Array.isArray(loser.fixes)  ? loser.fixes  : []),
    ].slice(0, 3)
    if (!winner.quote && loser.quote) winner.quote = loser.quote
    if (!winner.description && loser.description) winner.description = loser.description
    bySignature.set(signature, winner)
  }

  return Array.from(bySignature.values())
}

function enforceFixShape(report: any): void {
  for (const complaint of report.complaints || []) {
    if (!Array.isArray(complaint.fixes)) continue
    complaint.fixes = complaint.fixes.map((fix: any) => {
      const advanced = cleanModelText(String(fix.advancedFix || fix.simpleFix || ''))
      const shaped   = advanced.startsWith('Reviewers say ')
        ? advanced
        : `Reviewers say ${complaint.quote || complaint.title || 'this issue appears in reviews'} — ${complaint.title || 'the pattern repeats across reviews'} — ${fix.simpleFix || advanced || 'fix the specific reviewed defect'}`
      return {
        ...fix,
        advancedFix: cleanModelText(shaped),
        simpleFix:   cleanModelText(String(fix.simpleFix || '').replace(/^reviewers say\s+/i, '')),
        why:         cleanModelText(String(fix.why || complaint.frequency || complaint.revenueImpact || 'Reviewers described this.')),
      }
    })
  }
}

function buildTopActionsFromComplaints(complaints: any[]): any[] {
  return complaints
    .flatMap((complaint) =>
      (Array.isArray(complaint.fixes) ? complaint.fixes : []).map((fix: any) => ({
        action:  cleanModelText(String(fix.simpleFix || complaint.title || '')).replace(/\.$/, ''),
        detail:  cleanModelText(String(fix.advancedFix || complaint.shortDescription || complaint.description || '')),
        segment: cleanModelText(String(complaint.segment || complaint.title || 'Buyers affected by this complaint')),
      })),
    )
    .filter(action => action.action && action.detail)
    .slice(0, 3)
}

function applyDeterministicNarrative(report: any, ctx: ReturnType<typeof calculateHealthScore>): void {
  const topComplaint = report.complaints?.[0]
  const topStrength  = report.strengths?.[0]
  if (!topComplaint) return

  const complaintTitle     = cleanModelText(String(topComplaint.title || 'the top reviewed issue')).toLowerCase()
  const complaintFrequency = cleanModelText(String(topComplaint.frequency || topComplaint.revenueImpact || 'reviewers described this'))
  const strengthTitle      = cleanModelText(String(topStrength?.title || 'the strongest positive review theme')).toLowerCase()

  report.freeSummary = cleanModelText(
    `Health score ${ctx.healthScore}/100 is mainly pulled down by ${complaintTitle}, reported in ${complaintFrequency}. The strongest upside is ${strengthTitle}, which should stay visible in the listing and photos.`,
  )
  report.keyInsight = cleanModelText(
    `${complaintTitle} is not a broad product problem; it is a repeated reviewed pattern with a specific failure point. Fix the exact point reviewers named before changing unrelated parts of the product.`,
  )
  report.summary = cleanModelText(
    `Health score ${ctx.healthScore}/100 reflects ${complaintFrequency} tied to ${complaintTitle}. The main growth opportunity is to keep the praised ${strengthTitle} clear while fixing the reviewed failure point that creates low-star reviews.`,
  )
}

function applyOutputGuardrails(report: any): any {
  const cleaned = cleanModelOutput(report) as any
  cleaned.complaints = mergeDuplicateComplaints(
    Array.isArray(cleaned.complaints) ? cleaned.complaints : [],
  )
  enforceFixShape(cleaned)

  const derivedActions = buildTopActionsFromComplaints(cleaned.complaints)
  if (derivedActions.length >= 3) cleaned.topActions = derivedActions

  if (cleaned.quickWin && cleaned.complaints?.[0]?.fixes?.[0]) {
    const topFix = cleaned.complaints[0].fixes[0]
    cleaned.quickWin = {
      action: topFix.advancedFix,
      impact: cleaned.complaints[0].frequency || cleaned.complaints[0].revenueImpact || topFix.why,
      effort: cleanModelText(String(cleaned.quickWin.effort || 'Use the specific corrective action from the top complaint.')),
    }
  }

  return cleaned
}

// ── Analysis ──────────────────────────────────────────────────

interface ProductInfo {
  name:         string
  category:     string
  price?:       string
  description?: string
}

async function analyzeFreeWithGroq(
  reviews:     Array<{ rating: number; text: string }>,
  ctx:         ReturnType<typeof calculateHealthScore>,
  productInfo: ProductInfo,
): Promise<any> {
  const sanitizeReview = (t: string) =>
    t.replace(/ignore\s+(previous|all|above|prior)\s+(instructions?|prompts?|context)/gi, '[…]')
     .replace(/you\s+are\s+(now|a|an)\s+/gi, '[…]')
     .replace(/system\s*:/gi, '[…]')
     .replace(/assistant\s*:/gi, '[…]')
     .replace(/disregard\s+(all|previous|prior|above)/gi, '[…]')
     .replace(/forget\s+(all|previous|prior|above)/gi, '[…]')
     .replace(/override\s+(your|all|previous)/gi, '[…]')
     .replace(/\bdo not follow\b/gi, '[…]')
     .replace(/\bnew instruction/gi, '[…]')

  const patterns        = extractPatterns(reviews)
  const sampledReviews  = buildSmartSample(reviews, patterns, 60)
  const negativeReviews = sampledReviews.filter(r => r.rating <= 2).slice(0, 18)
  const positiveReviews = sampledReviews.filter(r => r.rating >= 4).slice(0, 12)
  const reviewsForPrompt = [...negativeReviews, ...positiveReviews]
    .map(r => `[${r.rating}★] ${sanitizeReview(r.text).slice(0, 180).trimEnd()}${r.text.length > 180 ? '…' : ''}`)
    .join('\n')

  const seoAnalysis = calculateSeoScore(reviews, productInfo.name)

  // [ROUTING] Free preview always uses 8b — simple 2-complaint extraction
  const freeRaw = await callGroq8b([
    {
      role: 'system' as const,
      content: `You are a review analysis engine. Return compact JSON only.
Rules:
- Use only facts visible in the provided reviews.
- Return exactly 2 complaints and 1 strength.
- Do not write fixes, recommendations, actions, SEO keywords, templates, or business advice.
- Complaint titles must name the exact reviewed symptom, not "quality issue" or "durability problem".
- Do not use these phrases: consider, this will help, improve quality, enhance quality, better materials, reduce returns, customer satisfaction, update listing.`,
    },
    {
      role: 'user' as const,
      content: `PRODUCT: <product_title>${productInfo.name}</product_title>
CATEGORY: ${productInfo.category}
REVIEWS ANALYZED: ${reviews.length}
HEALTH SCORE: ${ctx.healthScore}/100

REVIEWS:
<reviews>
${reviewsForPrompt}
</reviews>

Return ONLY this JSON:
{
  "complaints": [
    {
      "title": "<exact symptom in 4-8 words>",
      "severity": "CRITICAL|MEDIUM|LOW",
      "frequency": "<X of ${reviews.length} reviews>",
      "shortDescription": "<1-2 sentences describing only what reviewers reported>",
      "description": "<same as shortDescription>",
      "revenueImpact": "<X of ${reviews.length} reviews describe this>",
      "quote": "<verbatim quote from one provided review>"
    },
    {
      "title": "<exact symptom in 4-8 words>",
      "severity": "CRITICAL|MEDIUM|LOW",
      "frequency": "<X of ${reviews.length} reviews>",
      "shortDescription": "<1-2 sentences describing only what reviewers reported>",
      "description": "<same as shortDescription>",
      "revenueImpact": "<X of ${reviews.length} reviews describe this>",
      "quote": "<verbatim quote from one provided review>"
    }
  ],
  "strengths": [
    {
      "title": "<exact praised quality in 4-7 words>",
      "frequency": "<X of ${reviews.length} reviews>",
      "summary": "<1 sentence describing what buyers praised>",
      "quote": "<verbatim quote from one provided review>"
    }
  ]
}`,
    },
  ], 1400)

  let parsed: any = { complaints: [], strengths: [] }
  try {
    parsed = extractJson(freeRaw) as any
  } catch (err) {
    console.warn('[FreeCSV] Parse failed, using pattern fallback:', err)
  }

  const negCount = ctx.starCounts[1] + ctx.starCounts[2]
  const negPct   = ctx.totalReviewCount > 0
    ? Math.round((negCount / ctx.totalReviewCount) * 100)
    : 0

  let report: any = {
    healthScore:   ctx.healthScore,
    starBreakdown: { '1': ctx.starCounts[1], '2': ctx.starCounts[2], '3': ctx.starCounts[3], '4': ctx.starCounts[4], '5': ctx.starCounts[5] },
    freeSummary:   `Health score ${ctx.healthScore}/100 is based on ${reviews.length} reviews, with ${negPct}% unhappy buyers. Free preview shows the top reviewed problems and one strength; fixes and full SEO unlock on paid plans.`,
    keyInsight:    '',
    summary:       '',
    complaints:    Array.isArray(parsed?.complaints) ? parsed.complaints.slice(0, 2) : [],
    strengths:     Array.isArray(parsed?.strengths)  ? parsed.strengths.slice(0, 1)  : [],
    improvements:  [],
    seo:           { score: seoAnalysis.score },
    marketingCopy:   [],
    reviewTemplates: [],
    careGuide:       null,
    quickWin:        null,
    topActions:      [],
    _sectionsReady:  ['complaints', 'strengths', 'seo', 'summary'],
    _isLimited:      true,
  }

  report = applyOutputGuardrails(report)
  applyDeterministicNarrative(report, ctx)
  report.complaints    = (report.complaints || []).slice(0, 2).map((c: any) => ({ ...c, fixes: [], riskIfIgnored: '', urgency: '' }))
  report.strengths     = (report.strengths  || []).slice(0, 1)
  report.improvements  = []
  report.marketingCopy = []
  report.reviewTemplates = []
  report.careGuide     = null
  report.quickWin      = null
  report.topActions    = []
  report.seo           = { score: seoAnalysis.score }
  report._isLimited    = true

  return report
}

async function analyzeWithGroq(
  reviews:     Array<{ rating: number; text: string }>,
  ctx:         ReturnType<typeof calculateHealthScore>,
  productInfo: ProductInfo,
): Promise<any> {
  const patterns       = extractPatterns(reviews)
  const sampledReviews = buildSmartSample(reviews, patterns, 200)

  const sanitizeReview = (t: string) =>
    t.replace(/ignore\s+(previous|all|above|prior)\s+(instructions?|prompts?|context)/gi, '[…]')
     .replace(/you\s+are\s+(now|a|an)\s+/gi, '[…]')
     .replace(/system\s*:/gi, '[…]')
     .replace(/assistant\s*:/gi, '[…]')
     .replace(/disregard\s+(all|previous|prior|above)/gi, '[…]')
     .replace(/forget\s+(all|previous|prior|above)/gi, '[…]')
     .replace(/override\s+(your|all|previous)/gi, '[…]')
     .replace(/\bdo not follow\b/gi, '[…]')
     .replace(/\bnew instruction/gi, '[…]')

  const reviewText = sampledReviews
    .map(r =>
      `[${r.rating}★] ${sanitizeReview(r.text).slice(0, MAX_REVIEW_CHARS).trimEnd()}` +
      (r.text.length > MAX_REVIEW_CHARS ? '…' : ''),
    )
    .join('\n')

  const negativeReviews = sampledReviews.filter(r => r.rating <= 2).slice(0, 25)
  const positiveReviews = sampledReviews.filter(r => r.rating >= 4).slice(0, 30)
  // [ROUTING-3] fiveStarText capped at 10 for Call 3 (verbatim copy, 10 is plenty)
  const fiveStarReviews = sampledReviews.filter(r => r.rating === 5).slice(0, 10)

  const negReviewText = (negativeReviews.length > 0 ? negativeReviews : sampledReviews.slice(0, 20))
    .map(r => `[${r.rating}★] ${sanitizeReview(r.text).slice(0, 200).trimEnd()}${r.text.length > 200 ? '…' : ''}`)
    .join('\n')

  const posReviewText = (positiveReviews.length > 0 ? positiveReviews : sampledReviews.slice(0, 25))
    .map(r => `[${r.rating}★] ${sanitizeReview(r.text).slice(0, 200).trimEnd()}${r.text.length > 200 ? '…' : ''}`)
    .join('\n')

  const fiveStarText = (fiveStarReviews.length > 0 ? fiveStarReviews : positiveReviews.slice(0, 10))
    .map(r => `[5★] ${sanitizeReview(r.text).slice(0, 180).trimEnd()}${r.text.length > 180 ? '…' : ''}`)
    .join('\n')

  console.log(`[Parallel] Review splits — neg: ${negativeReviews.length}, pos: ${positiveReviews.length}, 5★: ${fiveStarReviews.length}`)

  const healthBlock    = formatHealthScoreForPrompt(ctx)
  const negativeCount  = sampledReviews.filter(r => r.rating <= 2).length
  const complaintGuide = getComplaintCountGuidance(reviews.length, negativeCount, sampledReviews.length)

  const worstReviews  = extractWorstReviews(reviews)
  const bestReviews   = extractBestReviews(reviews, 15)
  const domainResult  = await generateDomainAndSeo(productInfo.name, productInfo.category, worstReviews, bestReviews, productInfo.description)
  const domainKnowledge = domainResult.knowledge
  const seoAnalysis     = calculateSeoScore(reviews, productInfo.name)
  const seoTopPhrases   = domainResult.seoThemes.length >= 3 ? domainResult.seoThemes : seoAnalysis.topPhrases

  console.log(`[SEO] Score: ${seoAnalysis.score}/100 | Themes: ${seoTopPhrases.slice(0, 3).join(' | ')}`)

  const negCount = ctx.starCounts[1] + ctx.starCounts[2]
  const negPct   = ctx.totalReviewCount > 0 ? Math.round((negCount / ctx.totalReviewCount) * 100) : 0

  const descriptionLine = productInfo.description
    ? `\nSELLER'S LISTING DESCRIPTION:\n<listing_description>${productInfo.description.slice(0, 400).trimEnd()}</listing_description>\n`
    : ''

  const contextBlock = `PRODUCT: <product_title>${productInfo.name}</product_title>
CATEGORY: ${productInfo.category}
${productInfo.price ? `PRICE: $${productInfo.price}` : ''}
REVIEWS ANALYZED: ${reviews.length}${descriptionLine}

${healthBlock}

${patterns.promptSummary}

${domainKnowledge}

Classify each issue as SHIPPING / PRODUCTION / LISTING / DESIGN before writing fixes.`

  const systemPrompt = `You are a review analysis engine. Convert reviewer language into structured JSON. Every word you write must trace back to something a reviewer actually said or described.

━━━ GROUNDING LAW ━━━
- Quote or closely paraphrase what reviewers wrote. Do not abstract it.
- "Handle scales cracked along the wood grain near the pins after 3 weeks" → keep that specificity. Do not turn it into "durability issue".
- Never infer technical causes (materials, manufacturing, engineering) unless a reviewer explicitly named them.
- Minimum 3 reviews must support any claim. If only 1-2 mention something, skip it.

━━━ ABSOLUTELY BANNED PHRASES ━━━
These phrases are forbidden in every field. If you write any of them, the output fails:
  × "improve durability"          × "enhance quality"           × "update listing"
  × "better materials"            × "stronger construction"     × "improve craftsmanship"
  × "reduce returns"              × "improve customer satisfaction"
  × "customers will appreciate"   × "buyers expect"             × "enhance the experience"
  × "consider [anything]"         × "could involve"             × "may improve"
  × "this will help"              × "address this issue"        × "tackle this problem"
  × Any sentence starting with "To address this"
  × Any invented percentage improvement

━━━ TITLE RULE ━━━
Complaint titles must name the EXACT SYMPTOM reviewers described.
  ✓ GOOD: "Handle scales crack at pin after 3 weeks"
  ✓ GOOD: "Blade rusts near base within 2 weeks"
  ✗ BAD:  "Handle durability issues"
  ✗ BAD:  "Rust resistance problems"

━━━ FIX STRUCTURE — STRICT FORMAT ━━━
Each fix = one sentence following this exact pattern:
  "Reviewers say [exact symptom + location + timing from reviews] — [what this pattern reveals about where or how the failure starts] — [one specific action that follows directly from that pattern]"

GOOD EXAMPLE:
  "Reviewers say the crack starts specifically at the pin holes rather than along the full grain — cracks initiating at the pin holes rather than elsewhere means the stress is concentrated at the fastening points rather than in the wood itself — switch the pin configuration on this handle to brass compression rivets which distribute load across a wider surface area rather than creating a stress point"

BAD EXAMPLE (rejected):
  "Reviewers say handle cracked — this indicates a durability issue — improve the handle construction with better materials"

━━━ DISTINCT ANGLE RULE — NON-NEGOTIABLE ━━━
Each fix within a complaint MUST target a completely different layer:
  Fix 1 → WHERE and HOW the physical failure occurs
  Fix 2 → WHEN it fails — the trigger, usage pattern, or condition
  Fix 3 → WHAT buyers were told vs what they got (listing/expectation gap)

━━━ FIX COUNT — NON-NEGOTIABLE ━━━
  CRITICAL → exactly 3 fixes | MEDIUM → exactly 2 fixes | LOW → exactly 1 fix

━━━ COMPLAINT SEPARATION RULE ━━━
Each physical location or symptom that reviewers describe separately = its own complaint entry.

━━━ why FIELD FORMAT ━━━
Write only: "[X] of [Y] reviewers described this." Nothing else.

━━━ MARKETING COPY ━━━
Copy exact verbatim sentences from 5★ reviews. Do not paraphrase.

━━━ SEO ━━━
Keywords: copy the pre-calculated phrases verbatim.
Suggestions: use only phrases from 5★ reviews, never from complaint areas.`

  console.log(`[CSV] Starting sequential calls for ${reviews.length} reviews...`)

  // ── Call 1: COMPLAINTS — llama-3.3-70b-versatile ─────────
  // [ROUTING-1] Stays on 70b — hardest reasoning task.
  const complaintsRaw = await callGroq70b([
    { role: 'system' as const, content: systemPrompt },
    {
      role: 'user' as const,
      content: `${contextBlock}

${complaintGuide}

NEGATIVE REVIEWS (1★ and 2★ only):
<reviews>
${negReviewText}
</reviews>

STEP 1 — READ ALL NEGATIVE REVIEWS AND LIST EVERY DISTINCT SYMPTOM:
Go through each review. For each 1★ or 2★ review, note: what broke/failed, where on the product, and when. Separate symptoms = separate complaints.

STEP 2 — GROUP INTO COMPLAINTS:
Each distinct physical symptom or failure = one complaint. Do not merge.

STEP 3 — FOR EACH COMPLAINT, WRITE 3 FIXES ON 3 DIFFERENT LAYERS:
  Fix 1: WHERE and HOW — the exact physical location and symptom reviewers described
  Fix 2: WHEN and WHAT TRIGGERS IT — usage pattern, timing, or condition reviewers mentioned
  Fix 3: EXPECTATION GAP — what the listing implied vs what reviewers actually received

Each fix must start: "Reviewers say [exact reviewer words] —"

BANNED IN EVERY FIELD: "improve durability", "enhance quality", "better materials", "update listing", "address this", "reduce returns", "customers will appreciate", any sentence starting with "To address this", any invented percentage.

Return ONLY this JSON — start with { immediately:
{
  "complaints": [
    {
      "title": "<exact symptom + location in 5-7 words>",
      "severity": "CRITICAL|MEDIUM|LOW",
      "confidence": "High|Medium|Low",
      "fixPriority": "High|Medium|Low",
      "shortDescription": "<1-2 sentences using reviewer words — zero fixes>",
      "description": "<3 sentences: quote exact reviewer descriptions, buyer type, business pattern>",
      "revenueImpact": "<X of Y reviews describe this>",
      "riskIfIgnored": "<specific consequence reviewers described — no invented outcomes>",
      "urgency": "<what already happened in reviews — not predictions>",
      "frequency": "<X of Y reviews>",
      "quote": "<copy-paste verbatim from a review above>",
      "fixes": [
        {
          "advancedFix": "Reviewers say [exact symptom + location + timing] — [what pattern reveals about failure] — [specific action grounded in that pattern]",
          "simpleFix": "<same action plain one sentence>",
          "why": "<X> of <Y> reviewers described this."
        },
        {
          "advancedFix": "Reviewers say [when/trigger angle] — [what timing reveals] — [action targeting trigger]",
          "simpleFix": "<same action plain one sentence>",
          "why": "<X> of <Y> reviewers described this."
        },
        {
          "advancedFix": "Reviewers say [expectation vs reality] — [the gap] — [listing change to close gap]",
          "simpleFix": "<same action plain one sentence>",
          "why": "<X> of <Y> reviewers described this."
        }
      ]
    }
  ]
}`,
    },
  ], 3500)

  // [ROUTING] 35s sleep after 70b call — preserve existing TPM handling
  await sleep(SLEEP_AFTER_70B)

  // ── Call 2: STRENGTHS + IMPROVEMENTS — llama-3.3-70b-versatile ──
  // [ROUTING-2] Stays on 70b — creative synthesis from positive reviews.
  const strengthsRaw = await callGroq70b([
    { role: 'system' as const, content: systemPrompt },
    {
      role: 'user' as const,
      content: `${contextBlock}

FOCUS: What buyers love (from 4★ and 5★ reviews) + growth opportunities.

POSITIVE REVIEWS (4★ and 5★ only):
<reviews>
${posReviewText}
</reviews>

HARD CONSTRAINTS:
1. businessImpact must reference specific reviewer counts — "X of Y reviewers mention this"
2. NEVER write "drives initial sales", "encourages repeat business", "likely increases"
3. improvements impact: describe what changes for buyers, not invented percentages
4. NEVER start any sentence with "consider"

Return ONLY this JSON — start with { immediately:
{
  "strengths": [
    {
      "title": "<5-7 words naming exact quality praised>",
      "frequency": "<X of Y reviews>",
      "quote": "<verbatim 5★ sentence>",
      "segment": "<specific buyer type>",
      "summary": "<3 sentences: why this resonates, how it drives buying, how to amplify>",
      "businessImpact": "<2 sentences: what this strength does for repeat purchases and referrals>",
      "marketingAngle": "<verbatim 5★ sentence ready to paste into listing>"
    }
  ],
  "improvements": [
    {
      "title": "<growth opportunity — not a complaint fix>",
      "description": "<4 sentences: what to change, specific steps from review language>",
      "impact": "<what changes for buyers — no invented percentages>"
    }
  ]
}`,
    },
  ], 1800)

  // [ROUTING-3] Only 3s sleep before 8b call — separate TPM bucket
  await sleep(SLEEP_AFTER_8B)

  // ── Call 3: SEO + MARKETING COPY — llama-3.1-8b-instant ──
  // [ROUTING-3] Switched to 8b — pure extraction + verbatim copy.
  // SEO keywords are pre-calculated, marketing copy is verbatim quotes.
  // 8b handles this perfectly and is 3-4x faster than 70b here.
  // max_tokens: 1200 → 800 (output is structured and short)
  const seoRaw = await callGroq8b([
    { role: 'system' as const, content: systemPrompt },
    {
      role: 'user' as const,
      content: `${contextBlock}

PRE-CALCULATED SEO ANALYSIS:
${seoAnalysis.reasoning}

SEO KEYWORDS — COPY VERBATIM INTO magicKeywords (do not modify):
${seoTopPhrases.map((p, i) => `${i + 1}. "${p}"`).join('\n')}

5-STAR REVIEWS ONLY (for marketing copy — verbatim only):
<reviews>
${fiveStarText}
</reviews>

HARD CONSTRAINTS:
1. magicKeywords — copy the locked phrases above VERBATIM
2. seo.suggestions — ONLY from 5★ reviewer language, NEVER from complaint areas
3. marketingCopy — copy exact verbatim sentences from the reviews above

Return ONLY this JSON — start with { immediately:
{
  "seo": {
    "score": ${seoAnalysis.score},
    "magicKeywords": [${seoTopPhrases.map(p => `"${p}"`).join(', ')}],
    "issues": ["<phrase in reviews but absent from listing>", "<another gap>"],
    "suggestions": [
      "<exact phrase to add to title — from 5★ language only>",
      "<exact backend keyword phrase + why>",
      "<exact sentence to add to description>"
    ]
  },
  "marketingCopy": [
    "<verbatim word-for-word from a real 5★ review>",
    "<verbatim 5★>",
    "<verbatim 5★>",
    "<verbatim 5★>",
    "<verbatim 5★>"
  ],
  "reviewTemplates": [
    { "situation": "<specific complaint from reviews>", "template": "<3-4 sentence personal response>" },
    { "situation": "<another specific complaint>", "template": "<3-4 sentence response>" }
  ],
  "careGuide": {
    "do": [
      { "action": "<care instruction from reviewer language>", "reason": "<why>", "impact": "<which complaints this prevents>" },
      { "action": "<another>", "reason": "<why>", "impact": "<which>" }
    ],
    "avoid": [
      { "action": "<what caused failures per reviewers>", "reason": "<why>", "impact": "<which complaints>" },
      { "action": "<another>", "reason": "<why>", "impact": "<which>" }
    ]
  }
}`,
    },
  ], 800)   // was 1200 — 800 is generous for verbatim copy + short SEO output

  console.log('[CSV] Calls 1-3 complete. Parsing...')

  let complaintsData: any = { complaints: [] }
  let strengthsData:  any = { strengths: [], improvements: [] }
  let seoData:        any = { seo: null, marketingCopy: [], reviewTemplates: [], careGuide: null }

  try {
    const rawParsed = extractJson(complaintsRaw) as any
    if (Array.isArray(rawParsed)) {
      complaintsData = { complaints: rawParsed }
    } else if (Array.isArray(rawParsed?.complaints)) {
      complaintsData = rawParsed
    } else {
      const firstArray = Object.values(rawParsed || {}).find(v => Array.isArray(v))
      if (firstArray) complaintsData = { complaints: firstArray }
    }
    console.log(`[Parallel] Call 1 parsed — complaints: ${complaintsData.complaints?.length || 0}`)
  } catch (e) {
    console.error('[Parallel] Call 1 FAILED:', String(e).slice(0, 200))
    console.log('[Parallel] Call 1 raw (first 500):', complaintsRaw.slice(0, 500))
  }

  try {
    strengthsData = extractJson(strengthsRaw) as any
    console.log(`[Parallel] Call 2 parsed — strengths: ${strengthsData.strengths?.length || 0}, improvements: ${strengthsData.improvements?.length || 0}`)
  } catch (e) {
    console.error('[Parallel] Call 2 FAILED. First 300 chars:', strengthsRaw.slice(0, 300))
  }

  try {
    seoData = extractJson(seoRaw) as any
    console.log(`[Parallel] Call 3 parsed — seo: ${!!seoData.seo}, marketing: ${seoData.marketingCopy?.length || 0}`)
  } catch (e) {
    console.error('[Parallel] Call 3 FAILED. First 300 chars:', seoRaw.slice(0, 300))
  }

  // Retry Call 1 if empty — stays on 70b since this is the critical call
  if (!complaintsData.complaints || complaintsData.complaints.length === 0) {
    console.warn('[Parallel] Call 1 returned 0 complaints — retrying on 70b...')
    try {
      const retryRaw = await callGroq70b([
        { role: 'system' as const, content: systemPrompt },
        {
          role: 'user' as const,
          content: `${contextBlock}

Read these reviews and find every distinct physical problem mentioned.

REVIEWS:
<reviews>
${reviewText.slice(0, 3000)}
</reviews>

RULES:
- Title = exact symptom + location
- Each fix starts: "Reviewers say [exact words] — [pattern] — [specific action]"
- Fix 1 = physical symptom. Fix 2 = trigger/timing. Fix 3 = expectation gap.
- BANNED: "improve durability", "enhance quality", "better materials", any invented percentage.
- why field: "[X] of [Y] reviewers described this." only.

Return ONLY: { "complaints": [ { "title": "...", "severity": "CRITICAL|MEDIUM|LOW", "confidence": "High", "fixPriority": "High", "shortDescription": "...", "description": "...", "revenueImpact": "X of Y reviews", "riskIfIgnored": "...", "urgency": "...", "frequency": "X of Y reviews", "quote": "verbatim", "fixes": [ { "advancedFix": "Reviewers say ... — ... — ...", "simpleFix": "...", "why": "X of Y reviewers described this." }, { "advancedFix": "...", "simpleFix": "...", "why": "..." }, { "advancedFix": "...", "simpleFix": "...", "why": "..." } ] } ] }`,
        },
      ], 3000)
      const retryParsed = extractJson(retryRaw) as any
      if (Array.isArray(retryParsed?.complaints) && retryParsed.complaints.length > 0) {
        complaintsData = retryParsed
        console.log(`[Parallel] Retry succeeded — complaints: ${complaintsData.complaints.length}`)
      }
    } catch (retryErr) {
      console.error('[Parallel] Retry also failed:', retryErr)
    }
  }

  const topComplaintTitle = complaintsData.complaints?.[0]?.title || 'quality issues'
  const topStrengthTitle  = strengthsData.strengths?.[0]?.title   || 'product quality'

  // [ROUTING-4] Only 3s sleep before 8b Call 4
  await sleep(SLEEP_AFTER_8B)

  // ── Call 4: SUMMARY — llama-3.1-8b-instant ───────────────
  // [ROUTING-4] Switched to 8b — formats pre-calculated values into JSON.
  // No reasoning needed. max_tokens: 1000 → 600.
  const summaryRaw = await callGroq8b([
    { role: 'system' as const, content: systemPrompt },
    {
      role: 'user' as const,
      content: `${contextBlock}

TOP COMPLAINT FOUND: "${topComplaintTitle}"
TOP STRENGTH FOUND: "${topStrengthTitle}"
HEALTH SCORE: ${ctx.healthScore}/100
UNHAPPY BUYERS: ${negPct}%

HARD CONSTRAINTS:
1. freeSummary must name ${ctx.healthScore}/100 AND "${topComplaintTitle}" — ZERO fixes
2. quickWin impact: "X of Y buyers affected" — NEVER invent percentages
3. quickWin action: must start with "Reviewers say"
4. topActions: NEVER start with "consider"

Return ONLY this JSON — start with { immediately:
{
  "freeSummary": "<EXACTLY 2 sentences — must name ${ctx.healthScore}/100 AND '${topComplaintTitle}' — ZERO fixes>",
  "keyInsight": "<1 non-obvious reframe 2-3 sentences — NOT a complaint summary — zero fixes>",
  "summary": "<2-3 sentences: health score, biggest revenue threat, biggest opportunity>",
  "quickWin": {
    "action": "<highest-impact fix — grounded in reviewer language>",
    "impact": "<X of Y reviewers affected>",
    "effort": "<specific cost or time>"
  },
  "topActions": [
    { "action": "<6-10 words based on reviewer language>", "detail": "<4-5 sentences>", "segment": "<buyer segment>" },
    { "action": "<action 2>", "detail": "<detail>", "segment": "<segment>" },
    { "action": "<action 3>", "detail": "<detail>", "segment": "<segment>" }
  ]
}`,
    },
  ], 600)   // was 1000 — 600 is plenty for 3 sentences + JSON structure

  let summaryData: any = {}
  try {
    summaryData = extractJson(summaryRaw) as any
  } catch (e) {
    console.warn('[Parallel] Call 4 parse failed:', e)
  }

  console.log('[Parallel] All 4 calls complete. Merging...')

  const merged: any = {
    healthScore:     ctx.healthScore,
    starBreakdown:   { '1': ctx.starCounts[1], '2': ctx.starCounts[2], '3': ctx.starCounts[3], '4': ctx.starCounts[4], '5': ctx.starCounts[5] },
    freeSummary:     summaryData.freeSummary  || '',
    keyInsight:      summaryData.keyInsight   || '',
    summary:         summaryData.summary      || '',
    complaints:      Array.isArray(complaintsData.complaints)  ? complaintsData.complaints  : [],
    strengths:       Array.isArray(strengthsData.strengths)    ? strengthsData.strengths    : [],
    improvements:    Array.isArray(strengthsData.improvements) ? strengthsData.improvements : [],
    seo:             seoData.seo              || null,
    marketingCopy:   Array.isArray(seoData.marketingCopy)    ? seoData.marketingCopy    : [],
    reviewTemplates: Array.isArray(seoData.reviewTemplates)  ? seoData.reviewTemplates  : [],
    careGuide:       seoData.careGuide        || null,
    quickWin:        summaryData.quickWin     || null,
    topActions:      Array.isArray(summaryData.topActions)   ? summaryData.topActions   : [],
  }

  const { data: patched, overrides } = applyHardOverrides(merged, ctx)
  if (overrides.length > 0) console.warn('[HardOverrides] Patched:', overrides)

  let p = patched as any

  if (!p.freeSummary || p.freeSummary.length < 20) {
    p.freeSummary = `Your health score of ${ctx.healthScore}/100 is driven primarily by ${topComplaintTitle.toLowerCase()}, reported in ${negPct}% of reviews. A targeted fix on this issue could recover the majority of lost revenue within 60 days.`
  }
  if (!p.keyInsight || p.keyInsight.length < 20) {
    const critCount = p.complaints?.filter((c: any) => c.severity === 'CRITICAL').length || 0
    p.keyInsight = `With ${ctx.totalReviewCount} reviews analyzed, ${critCount} critical issue${critCount !== 1 ? 's' : ''} ${critCount !== 1 ? 'are' : 'is'} responsible for the majority of your 1-star and 2-star reviews.`
  }
  if (!p.summary || p.summary.length < 20) {
    p.summary = `Health score ${ctx.healthScore}/100 — the biggest revenue threat is ${topComplaintTitle.toLowerCase()}. The biggest growth opportunity is amplifying ${topStrengthTitle.toLowerCase()}.`
  }
  if (!p.improvements || p.improvements.length === 0) {
    p.improvements = [{ title: 'Amplify top strength in listing copy', description: `Your ${topStrengthTitle.toLowerCase()} is already resonating with buyers — move it to the first line of your listing description and add a backend keyword that matches how buyers describe it in 5-star reviews.`, impact: 'Improved alignment between search intent and listing headline.' }]
  }
  if (p.seo && seoTopPhrases.length >= 3) {
    const currentKeywords: string[] = p.seo.magicKeywords || []
    const hasFragments = currentKeywords.some((k: string) => k.split(' ').length === 1 || k.startsWith('the ') || k.startsWith('this '))
    if (hasFragments || currentKeywords.length < 3) {
      console.warn('[SEO] Restoring pre-call themes')
      p.seo.magicKeywords = seoTopPhrases.slice(0, 5)
    }
  }
  if (!p.topActions || p.topActions.length < 3) {
    const actions = Array.isArray(p.topActions) ? p.topActions : []
    while (actions.length < 3) actions.push({ action: '', detail: '', segment: '' })
    p.topActions = actions.slice(0, 3)
  }
  if (!p.marketingCopy || p.marketingCopy.length < 5) {
    const best5star = sampledReviews.filter(r => r.rating === 5).slice(0, 5)
    p.marketingCopy = Array.isArray(p.marketingCopy) ? p.marketingCopy : []
    while (p.marketingCopy.length < 5 && best5star.length > 0) {
      const r = best5star.shift()
      if (r) p.marketingCopy.push(r.text.slice(0, 200))
    }
  }

  p = applyOutputGuardrails(p)
  applyDeterministicNarrative(p, ctx)

  try {
    const semanticErrors = validateSemanticConstraints(p, ctx)
    const mktViolations  = semanticErrors.filter(e => e.field.startsWith('marketingCopy'))
    if (mktViolations.length > 0) {
      console.log('[SemanticCheck] marketingCopy violations — correcting...')
      const violations = mktViolations.map(e => `  • ${e.field}: ${e.message}`).join('\n')
      try {
        // [ROUTING] Semantic correction also uses 8b — simple substitution task
        const semContent = await callGroq8b([
          { role: 'system' as const, content: systemPrompt },
          {
            role: 'user' as const,
            content: `REVIEWS:\n<reviews>\n${reviewText.slice(0, 2000)}\n</reviews>\n\nThe marketingCopy field contains items NOT verbatim from the reviews.\n\nVIOLATIONS:\n${violations}\n\nFix ONLY marketingCopy — replace each with a verbatim 5★ sentence.\nReturn: { "marketingCopy": ["...", "...", "...", "...", "..."] }`,
          },
        ], 600)
        const semParsed = extractJson(semContent) as any
        if (Array.isArray(semParsed?.marketingCopy) && semParsed.marketingCopy.length >= 5) {
          p.marketingCopy = semParsed.marketingCopy
          console.log('[SemanticCheck] marketingCopy corrected')
        }
      } catch { console.warn('[SemanticCheck] Correction failed — keeping original') }
    }
  } catch (semErr) {
    console.warn('[SemanticCheck] Validation threw — skipping:', semErr)
  }

  p = applyOutputGuardrails(p)
  applyDeterministicNarrative(p, ctx)

  console.log(`[Parallel] Done. Complaints: ${p.complaints?.length || 0}, Strengths: ${p.strengths?.length || 0}, Improvements: ${p.improvements?.length || 0}`)
  return p
}

// ── Plan limits ───────────────────────────────────────────────

export function applyPlanLimits(report: any, plan: string, isAdminUser: boolean) {
  if (isAdminUser || plan === 'pro') return { ...report, _isLimited: false }
  if (plan === 'starter') return { ...report, complaints: report.complaints || [], improvements: report.improvements || [], _isLimited: false }
  return {
    ...report,
    complaints:      (report.complaints || []).slice(0, 2),
    strengths:       (report.strengths  || []).slice(0, 1),
    improvements:    [],
    marketingCopy:   [],
    reviewTemplates: [],
    seo:             report.seo ? { score: report.seo.score } : null,
    topActions:      [],
    _isLimited:      true,
  }
}

// ── Main handler ──────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const csrfError = checkCsrf(request)
  if (csrfError) return csrfError

  const ip = getClientIp(request)

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Please log in first' }, { status: 401 })

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

    let csvCreditsDeducted  = false
    let csvCreditsRefunded  = false
    const csvCreditCost     = 20
    const refundCsvCredits  = async () => {
      if (!csvCreditsDeducted || csvCreditsRefunded) return
      csvCreditsRefunded = true
      try {
        const { error } = await supabase.rpc('add_credits', { p_user_id: user.id, p_amount: csvCreditCost })
        if (error) {
          console.error('[CSV] Credit refund RPC failed — MANUAL REVIEW NEEDED:', { userId: user.id, amount: csvCreditCost, error: error.message })
        } else {
          console.log(`[CSV] Refunded ${csvCreditCost} credits to ${user.id}`)
        }
      } catch (e: any) {
        console.error('[CSV] Credit refund threw — MANUAL REVIEW NEEDED:', { userId: user.id, amount: csvCreditCost, error: e?.message })
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

    try {
      const ctx = calculateHealthScore(reviews, reviews.length)
      console.log(`[HealthScore] ${ctx.healthScore} | Raw: ${ctx.weightedRaw.toFixed(1)} | Penalties: ${ctx.penaltyCount}`)

      const reviewInput     = reviews.map(({ rating, text }) => ({ rating, text }))
      const useFreePreview  = !isAdminUser && plan === 'free'
      const analysis        = useFreePreview
        ? await analyzeFreeWithGroq(reviewInput, ctx, productInfo)
        : await analyzeWithGroq(reviewInput, ctx, productInfo)

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

      // Only increment for plans that didn't already increment at the gate (free uses try_increment_analyses_count above)
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
      throw err
    }
  } catch (error: any) {
    console.error('[CSV Analyze] Unhandled error:', error instanceof Error ? error.message : String(error))
    const limitInfo = getGroqRateLimitInfo(error)
    if (limitInfo.isRateLimit) {
      return NextResponse.json({ error: friendlyGroqLimitMessage(limitInfo.retryAfterSeconds), retryAfterSeconds: limitInfo.retryAfterSeconds }, { status: 429 })
    }
    return NextResponse.json({ error: 'Analysis failed. Please try again or contact support.' }, { status: 500 })
  }
}