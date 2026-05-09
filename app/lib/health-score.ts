// ============================================================
// lib/health-score.ts
// Deterministic health score calculator.
// Called before the LLM — results are injected as locked inputs.
// The model is NEVER asked to calculate or count anything.
//
// FIXES APPLIED:
//  [#7] HealthScoreResult → ReportContext  (single source of truth)
//  [#7] reviewTexts added  (marketingCopy verbatim check)
//  [#7] tier added         (drives schema shape in report-schema.ts)
//  [#7] detectTier() exported
//  [#7] formatHealthScoreForPrompt() takes ReportContext, not HealthScoreResult
//  [#7] applyHardOverrides() — fixes numeric drift after Zod passes, no LLM re-call
//  [#4] validateSemanticConstraints() — verbatim, dupe, filler checks
// ============================================================

export interface ReviewSample {
  rating: number
  text:   string
  id?:    string   // optional — for marketingCopy cross-reference tracing
}

export interface StarDistribution {
  1: number
  2: number
  3: number
  4: number
  5: number
}

// ─────────────────────────────────────────────────────────────
// ReportContext — the single object that travels the whole pipeline
//
//   calculateHealthScore()
//     → formatHealthScoreForPrompt()   (locked-data prompt block)
//     → validateReport(raw, ctx)       (schema bakes constraints in)
//     → applyHardOverrides(report,ctx) (numeric patch after Zod)
//     → validateSemanticConstraints()  (content quality check)
// ─────────────────────────────────────────────────────────────

export interface ReportContext {
  /** Final clamped score (20–100). Hard-locked in schema superRefine. */
  healthScore:      number
  /** Exact star counts. Locked in schema superRefine. */
  starCounts:       StarDistribution
  /** Total reviews scored. starBreakdown must sum to this. */
  totalSampled:     number
  /** Full aggregate product count (display/logging only). */
  totalReviewCount: number
  /** Pre-penalty weighted average (debug). */
  weightedRaw:      number
  /** How many reviews triggered a damage/return penalty. */
  penaltyCount:     number
  /** First 5 penalised snippets injected into prompt for context. */
  penalizedReviews: string[]
  /**
   * All sampled review texts — used by validateSemanticConstraints()
   * for marketingCopy verbatim cross-reference.
   */
  reviewTexts:      string[]
  /**
   * 'pro'  → shortDescription required on every complaint
   * 'free' → shortDescription optional
   * Drives discriminated-union schema selection in report-schema.ts.
   */
  tier:             'pro' | 'free'
}

// ─────────────────────────────────────────────────────────────
// Damage / return keyword list
// More specific phrases first — prevents double-counting.
// ─────────────────────────────────────────────────────────────

const DAMAGE_KEYWORDS: readonly string[] = [
  'broke apart',
  'fell apart',
  'came apart',
  'snapped off',
  'chipped off',
  'cracked open',
  'broke off',
  'broken on arrival',
  'arrived broken',
  'arrived damaged',
  'came broken',
  'came damaged',
  'asked for refund',
  'requested refund',
  'got a refund',
  'full refund',
  'returned it',
  'had to return',
  'sent it back',
  'broke',
  'broken',
  'cracked',
  'snapped',
  'chipped',
  'shattered',
  'damaged',
  'defective',
  'refund',
  'returned',
]

/**
 * Returns true if the review text contains at least one damage/return keyword.
 * Each review is penalised at most once regardless of how many keywords match.
 */
function hasDamageKeyword(text: string): boolean {
  const lower = text.toLowerCase()
  for (const kw of DAMAGE_KEYWORDS) {
    if (lower.includes(kw)) return true
  }
  return false
}

// ─────────────────────────────────────────────────────────────
// Tier detection helper
// ─────────────────────────────────────────────────────────────

/**
 * Returns an explicit tier override when provided, otherwise auto-detects
 * from review count. Replace heuristic with your real business logic.
 */
export function detectTier(
  totalReviewCount: number,
  explicitTier?:    'pro' | 'free',
): 'pro' | 'free' {
  if (explicitTier) return explicitTier
  return totalReviewCount >= 10 ? 'pro' : 'free'
}

// ─────────────────────────────────────────────────────────────
// Main calculator
// ─────────────────────────────────────────────────────────────

/**
 * Call this BEFORE building the LLM prompt.
 *
 * @param sampledReviews   – reviews being analysed
 * @param totalReviewCount – full aggregate count from the listing
 * @param tier             – explicit tier override (optional)
 */
export function calculateHealthScore(
  sampledReviews:   ReviewSample[],
  totalReviewCount: number,
  tier?:            'pro' | 'free',
): ReportContext {
  const starCounts: StarDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  const penalizedReviews: string[] = []
  let penaltyCount = 0

  for (const review of sampledReviews) {
    const star = Math.min(5, Math.max(1, Math.round(review.rating))) as 1 | 2 | 3 | 4 | 5
    starCounts[star]++

    if (hasDamageKeyword(review.text)) {
      penaltyCount++
      if (penalizedReviews.length < 5) {
        penalizedReviews.push(review.text.slice(0, 120).trim())
      }
    }
  }

  const total = sampledReviews.length

  // Weighted score formula: 5★=100 · 4★=75 · 3★=50 · 2★=25 · 1★=0
  const weightedRaw = total === 0
    ? 0
    : (
        (starCounts[5] * 100) +
        (starCounts[4] * 75)  +
        (starCounts[3] * 50)  +
        (starCounts[2] * 25)  +
        (starCounts[1] * 0)
      ) / (total * 100) * 100

  // Apply damage penalties — no cap, intentional floor collapse for bad products
  const penalized = weightedRaw - (penaltyCount * 5)

  // Floor at 20, Math.floor not Math.round (never round up a bad score)
  const healthScore = Math.max(20, Math.floor(penalized))

  return {
    healthScore,
    starCounts,
    totalSampled:     total,
    totalReviewCount,
    weightedRaw,
    penaltyCount,
    penalizedReviews,
    reviewTexts:      sampledReviews.map(r => r.text),
    tier:             detectTier(totalReviewCount, tier),
  }
}

// ─────────────────────────────────────────────────────────────
// Prompt formatter
//
// FIX [#7]: now takes ReportContext so tier, totalSampled sum
// rule, and targeted HARD RULES are all in the same block.
// ─────────────────────────────────────────────────────────────

export function formatHealthScoreForPrompt(ctx: ReportContext): string {
  const {
    healthScore, starCounts, totalSampled, totalReviewCount,
    weightedRaw, penaltyCount, penalizedReviews, tier,
  } = ctx

  const floorApplied = Math.floor(weightedRaw - penaltyCount * 5) < 20

  const penalizedBlock = penalizedReviews.length > 0
    ? `\nFlagged review snippets (damage/return signals):\n${
        penalizedReviews.map((s, i) => `  ${i + 1}. "${s}"`).join('\n')
      }`
    : ''

  return `\
════════════════════════════════════════
PRE-CALCULATED DATA — USE EXACTLY AS SHOWN, DO NOT RECALCULATE
════════════════════════════════════════
Report tier: ${tier.toUpperCase()}

Health score (FINAL, LOCKED): ${healthScore}/100
  Weighted base score  : ${weightedRaw.toFixed(2)}
  Damage/return reviews: ${penaltyCount} (−${penaltyCount * 5} points)
  Floor applied        : ${floorApplied ? 'yes (clamped to 20)' : 'no'}

Star distribution — ${totalSampled} sampled of ${totalReviewCount} total (EXACT COUNTS):
  5★: ${starCounts[5]}
  4★: ${starCounts[4]}
  3★: ${starCounts[3]}
  2★: ${starCounts[2]}
  1★: ${starCounts[1]}
  ──
  Σ : ${totalSampled}  ← starBreakdown values MUST sum to exactly this

You MUST use ${healthScore} as the healthScore in your JSON output.
You MUST reference the counts above when writing frequency fields.
You MUST NOT recalculate, re-estimate, or override these numbers.
${penalizedBlock}
HARD RULES — violations will trigger a correction loop:
  • healthScore MUST be exactly ${healthScore}
  • starBreakdown[1–5] MUST be integers summing to ${totalSampled}
  • topActions MUST have exactly 3 items
  • strengths MUST have at least 2 items; businessImpact and marketingAngle ≥40 chars each
  • marketingCopy MUST have exactly 5 items copied verbatim from the reviews
  • reviewTemplates MUST have exactly 2 items
  • every complaint MUST have 1–3 fixes with both advancedFix and simpleFix
  • shortDescription is ${tier === 'pro' ? 'REQUIRED on every complaint' : 'optional'}
  • freeSummary and keyInsight are REQUIRED at root level
════════════════════════════════════════`
}

// ─────────────────────────────────────────────────────────────
// Hard overrides — patch numeric drift without re-entering LLM
//
// FIX [#7]: closes the gap between health-score constraints and
// schema validation. Numeric drift is fixed here in O(1) — the
// correction loop only fires for structural Zod failures.
// ─────────────────────────────────────────────────────────────

export interface OverrideResult<T> {
  data:      T
  overrides: string[]  // human-readable log of what was patched
}

export function applyHardOverrides<T extends {
  healthScore:   number
  starBreakdown: Record<'1' | '2' | '3' | '4' | '5', number>
}>(
  report: T,
  ctx:    ReportContext,
): OverrideResult<T> {
  const overrides: string[] = []
  const patched   = { ...report }

  // 1. healthScore drift
  if (patched.healthScore !== ctx.healthScore) {
    overrides.push(
      `healthScore: model returned ${patched.healthScore}, locked to ${ctx.healthScore}`
    )
    patched.healthScore = ctx.healthScore
  }

  // 2. starBreakdown drift — patch each key individually
  const sb      = { ...patched.starBreakdown }
  const keys    = ['1', '2', '3', '4', '5'] as const
  let   drifted = false

  for (const k of keys) {
    const expected = ctx.starCounts[Number(k) as 1 | 2 | 3 | 4 | 5]
    if (sb[k] !== expected) {
      overrides.push(`starBreakdown[${k}]: model returned ${sb[k]}, locked to ${expected}`)
      sb[k]   = expected
      drifted = true
    }
  }
 if (drifted) patched.starBreakdown = sb

  // Enforce fix counts per severity — log violations for correction pass
  const complaints = (patched as any).complaints || []
  for (const complaint of complaints) {
    const required = complaint.severity === 'CRITICAL' ? 3
                   : complaint.severity === 'MEDIUM'   ? 2
                   : 1
    const actual = complaint.fixes?.length || 0
    if (actual < required) {
      overrides.push(
        `complaint "${complaint.title}": has ${actual} fix(es), severity ${complaint.severity} requires ${required}`
      )
    }
  }

  return { data: patched, overrides }
}

// ─────────────────────────────────────────────────────────────
// Semantic constraint validator
//
// FIX [#4]: marketingCopy verbatim rule moved from prompt comment
// into runtime code — now actually enforced, not just stated.
//
// Runs AFTER Zod passes. These are content-quality checks Zod
// cannot express. Errors here are logged/flagged but do NOT
// re-trigger the LLM correction loop.
// ─────────────────────────────────────────────────────────────

export interface SemanticError {
  field:   string
  message: string
}

/**
 * Fuzzy containment: true if needle is a substring of any review
 * after normalising whitespace and case.
 */
function isVerbatimFromReviews(needle: string, reviewTexts: string[]): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim()
  const n    = norm(needle)
  return reviewTexts.some(r => norm(r).includes(n))
}

export function validateSemanticConstraints(
  report: {
    marketingCopy: string[]
    strengths:     Array<{ title: string; summary: string }>
    complaints:    Array<{ title: string }>
  },
  ctx: ReportContext,
): SemanticError[] {
  const errors: SemanticError[] = []

  // 1. marketingCopy verbatim check
  report.marketingCopy.forEach((copy, i) => {
    if (!isVerbatimFromReviews(copy, ctx.reviewTexts)) {
      errors.push({
        field:   `marketingCopy[${i}]`,
        message: `"${copy.slice(0, 60)}…" not found verbatim in any sampled review`,
      })
    }
  })

  // 2. Duplicate strength titles
  const seenStrengths = new Set<string>()
  report.strengths.forEach((s, i) => {
    const key = s.title.toLowerCase().trim()
    if (seenStrengths.has(key)) {
      errors.push({ field: `strengths[${i}].title`, message: `Duplicate title: "${s.title}"` })
    }
    seenStrengths.add(key)
  })

  // 3. Strength summary must differ from title (filler detection)
  report.strengths.forEach((s, i) => {
    if (s.summary.toLowerCase().trim() === s.title.toLowerCase().trim()) {
      errors.push({ field: `strengths[${i}].summary`, message: 'summary is identical to title — likely filler' })
    }
  })

  // 4. Complaint titles must be unique
  const seenComplaints = new Set<string>()
  report.complaints.forEach((c, i) => {
    const key = c.title.toLowerCase().trim()
    if (seenComplaints.has(key)) {
      errors.push({ field: `complaints[${i}].title`, message: `Duplicate title: "${c.title}"` })
    }
    seenComplaints.add(key)
  })

  return errors
}