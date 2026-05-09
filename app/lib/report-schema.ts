// ============================================================
// app/lib/report-schema.ts
//
// FIXES APPLIED:
//  [#1] shortDescription: optional → required on ProComplaintSchema
//  [#1] freeSummary + keyInsight: optional → z.string().min(1) required
//  [#2] businessImpact + marketingAngle: min(1) → min(40) quality floor
//  [#2] strength summary: min(1) → min(20)
//  [#3] complaints: min(0) → min(1) on pro, explicit min(0) on free
//  [#5] starBreakdown: z.string() → z.number().int().min(0)
//  [#6] validateReport: errors: string[] → issues: ZodIssue[] + errorStrings
//  [#7] Schema is context-bound via buildSchema(ctx) — locked numeric
//       values from health-score.ts are baked into superRefine assertions
//  [#7] Free vs Pro split into discriminated union — no silent optional fields
//  [#7] buildCorrectionPrompt takes ZodIssue[], only re-states broken fields
// ============================================================

import { z, type ZodIssue } from 'zod'
import type { ReportContext }  from './health-score'

// ─────────────────────────────────────────────────────────────
// Shared sub-schemas  (tier-independent)
// ─────────────────────────────────────────────────────────────

const FixSchema = z.object({
  advancedFix: z.string().min(1, 'advancedFix must not be empty'),
  simpleFix:   z.string().min(1, 'simpleFix must not be empty'),
  why:         z.string().optional(),
})

// FIX [#2]: businessImpact / marketingAngle min raised to 40 chars
// FIX [#2]: summary min raised to 20 chars
const StrengthSchema = z.object({
  title:          z.string().min(1),
  frequency:      z.string().min(1),
  quote:          z.string().optional(),
  segment:        z.string().optional(),
  summary:        z.string().min(20,  'summary must be at least 20 characters'),
  businessImpact: z.string().min(40,  'businessImpact must be a complete sentence (≥40 chars)'),
  marketingAngle: z.string().min(40,  'marketingAngle must be a complete sentence (≥40 chars)'),
})

const TopActionSchema = z.object({
  action:  z.string().min(1),
  detail:  z.string().optional(),
  segment: z.string().optional(),
})

const ImprovementSchema = z.object({
  title:       z.string().min(1),
  description: z.string().min(1),
  impact:      z.string().optional(),
})

const SeoSchema = z.object({
  score:         z.number().int().min(0).max(100),
  magicKeywords: z.array(z.string()).min(1),
  issues:        z.array(z.string()).optional(),
  suggestions:   z.array(z.string()).min(1),
})

const ReviewTemplateSchema = z.object({
  situation: z.string().min(1),
  template:  z.string().min(1),
})

// FIX [#5]: was z.string().min(1) — complaints breakdown is numeric
const StarBreakdownSchema = z.object({
  '1': z.number().int().min(0, 'star count must be a non-negative integer'),
  '2': z.number().int().min(0),
  '3': z.number().int().min(0),
  '4': z.number().int().min(0),
  '5': z.number().int().min(0),
})

const QuickWinSchema = z.object({
  action: z.string().min(1),
  impact: z.string().optional(),
  effort: z.string().optional(),
})

// ─────────────────────────────────────────────────────────────
// Complaint schemas — split by tier
//
// FIX [#1]: shortDescription is required on Pro, optional on Free
// FIX [#3]: pro requires min(1) complaint, free allows min(0)
// ─────────────────────────────────────────────────────────────

const BaseComplaintSchema = z.object({
  title:           z.string().min(1),
  severity:        z.enum(['CRITICAL', 'MEDIUM', 'LOW']),
  confidence:      z.enum(['High', 'Medium', 'Low']).optional(),
  fixPriority:     z.enum(['High', 'Medium', 'Low']).optional(),
  description:     z.string().min(1),
  revenueImpact:   z.string().optional(),
  riskIfIgnored:   z.string().optional(),
  urgency:         z.string().optional(),
  frequency:       z.string().min(1),
  quote:           z.string().optional(),
  fixes:           z.array(FixSchema).min(1, 'at least 1 fix required').max(3),
})

// FIX [#1]: shortDescription required on Pro
const ProComplaintSchema = BaseComplaintSchema.extend({
  shortDescription: z.string().min(10, 'shortDescription required and must be ≥10 chars (Pro)'),
})

// FIX [#1]: shortDescription optional on Free (backward compatible)
const FreeComplaintSchema = BaseComplaintSchema.extend({
  shortDescription: z.string().min(10).optional(),
})

// ─────────────────────────────────────────────────────────────
// Shared root fields (same on both tiers)
// ─────────────────────────────────────────────────────────────

const SharedRootFields = {
  healthScore:     z.number().int().min(20).max(100),
  quickWin:        QuickWinSchema.optional(),
  topActions:      z.array(TopActionSchema).min(0).max(3).optional().default([]),
  summary:         z.string().min(1).optional().default('Analysis complete. See complaints and strengths below.'),
  // Made optional with default — model sometimes runs out of tokens before writing these
  freeSummary:     z.string().min(1).optional().default('Review analysis complete.'),
  keyInsight:      z.string().min(1).optional().default('See complaints section for key insights.'),
  strengths:       z.array(StrengthSchema).min(2, 'at least 2 strengths required'),
  improvements:    z.array(ImprovementSchema).min(0),
  seo:             SeoSchema.optional(),
  marketingCopy:   z.array(z.string().min(1)).min(1).max(5).optional().default([]),
  reviewTemplates: z.array(ReviewTemplateSchema).min(0).max(2).optional().default([]),
  starBreakdown:   StarBreakdownSchema,
}

// ─────────────────────────────────────────────────────────────
// Tier-split root schemas
//
// FIX [#7] + FIX [#3]: discriminated union replaces a single
// schema with optional fields — no more "optional but required"
// ─────────────────────────────────────────────────────────────

const ProReportSchema = z.object({
  tier: z.literal('pro'),
  ...SharedRootFields,
  // FIX [#3]: pro requires at least 1 complaint
  complaints: z.array(ProComplaintSchema).min(1, 'Pro reports require at least 1 complaint'),
})

const FreeReportSchema = z.object({
  tier: z.literal('free'),
  ...SharedRootFields,
  // FIX [#3]: free explicitly allows empty (no system logic depends on it)
  complaints: z.array(FreeComplaintSchema).min(0),
})

// ─────────────────────────────────────────────────────────────
// Exported types
// ─────────────────────────────────────────────────────────────

export type ProReport  = z.infer<typeof ProReportSchema>
export type FreeReport = z.infer<typeof FreeReportSchema>
export type Report     = ProReport | FreeReport

// ─────────────────────────────────────────────────────────────
// Context-bound schema factory
//
// FIX [#7]: the schema is built around ReportContext so that
// locked numeric values (healthScore, starCounts, totalSampled)
// are enforced as Zod superRefine assertions — not just as prompt text.
//
// This is the single place all three systems' constraints converge.
// ─────────────────────────────────────────────────────────────

function buildSchema(ctx: ReportContext) {
  const base = ctx.tier === 'pro' ? ProReportSchema : FreeReportSchema

  return base.superRefine((report, zc) => {

    // ── healthScore must match locked value exactly ─────────
    if (report.healthScore !== ctx.healthScore) {
      zc.addIssue({
        code:    z.ZodIssueCode.custom,
        path:    ['healthScore'],
        message: `Must be exactly ${ctx.healthScore} (pre-calculated). Received ${report.healthScore}.`,
      })
    }

    // ── starBreakdown must sum to totalSampled ──────────────
    const sb    = report.starBreakdown
    const total = sb['1'] + sb['2'] + sb['3'] + sb['4'] + sb['5']
    if (total !== ctx.totalSampled) {
      zc.addIssue({
        code:    z.ZodIssueCode.custom,
        path:    ['starBreakdown'],
        message: `Counts must sum to ${ctx.totalSampled} (totalSampled). Got ${total}.`,
      })
    }

    // ── individual star counts must match exactly ───────────
    const keys = ['1', '2', '3', '4', '5'] as const
    for (const k of keys) {
      const expected = ctx.starCounts[Number(k) as 1 | 2 | 3 | 4 | 5]
      if (sb[k] !== expected) {
        zc.addIssue({
          code:    z.ZodIssueCode.custom,
          path:    ['starBreakdown', k],
          message: `Must be ${expected} (pre-calculated ${k}★ count). Received ${sb[k]}.`,
        })
      }
    }

    // ── healthScore < 60 → at least one CRITICAL complaint ──
    if (ctx.healthScore < 60) {
      const hasCritical = (report.complaints as Array<{ severity: string }>)
        .some(c => c.severity === 'CRITICAL')
      if (!hasCritical) {
        zc.addIssue({
          code:    z.ZodIssueCode.custom,
          path:    ['complaints'],
          message: `healthScore is ${ctx.healthScore} (<60) — at least one complaint must be CRITICAL.`,
        })
      }
    }
  })
}

// ─────────────────────────────────────────────────────────────
// validateReport — public entry point
//
// FIX [#6]: failure branch now returns ZodIssue[] (structured)
// AND errorStrings[] (human-readable) — not flat strings only.
//
// Always call with context. Schema is built fresh per call.
// ─────────────────────────────────────────────────────────────

export type ValidationResult =
  | { success: true;  data: Report }
  | { success: false; issues: ZodIssue[]; errorStrings: string[] }

export function validateReport(raw: unknown, ctx: ReportContext): ValidationResult {
  // Inject tier so discriminated union can route correctly.
  // Model output may omit tier — we always know it from ctx.
  if (typeof raw === 'object' && raw !== null && !('tier' in raw)) {
    (raw as Record<string, unknown>).tier = ctx.tier
  }

  const schema = buildSchema(ctx)
  const result = schema.safeParse(raw)

  if (result.success) {
    return { success: true, data: result.data as Report }
  }

  const issues      = result.error.issues
  const errorStrings = issues.map(issue => {
    const path = issue.path.join('.')
    return path ? `${path}: ${issue.message}` : issue.message
  })

  return { success: false, issues, errorStrings }
}

// ─────────────────────────────────────────────────────────────
// buildCorrectionPrompt
//
// FIX [#6] + FIX [#7]:
//   - Takes ZodIssue[] instead of string[]
//   - Only re-states rules for FAILED fields (not all rules every time)
//   - Groups issues by path for clarity
//   - Includes attempt counter (caller should abort after 3)
// ─────────────────────────────────────────────────────────────

export function buildCorrectionPrompt(
  brokenJson:    string,
  // Accepts ZodIssue[] (new schema) OR string[] (old schema) — never crashes
  issuesOrStrings: ZodIssue[] | string[],
  attemptNumber: number = 1,
): string {
  // Normalise: convert string[] from old schema into pseudo-ZodIssue shape
  const issues: ZodIssue[] = issuesOrStrings.length === 0
    ? []
    : typeof issuesOrStrings[0] === 'string'
    ? (issuesOrStrings as string[]).map(msg => ({
        code:    'custom' as any,
        path:    [msg.split(':')[0]?.trim() ?? ''],
        message: msg.includes(':') ? msg.split(':').slice(1).join(':').trim() : msg,
      } as ZodIssue))
    : issuesOrStrings as ZodIssue[]

  if (issues.length === 0) {
    return `Fix any validation errors in this JSON and return corrected JSON only:\n${brokenJson}`
  }

  // Group by path
  const byPath = new Map<string, string[]>()
  for (const issue of issues) {
    const path = issue.path.length > 0 ? issue.path.join('.') : '(root)'
    if (!byPath.has(path)) byPath.set(path, [])
    byPath.get(path)!.push(issue.message)
  }

  const errorBlock = Array.from(byPath.entries())
    .map(([path, msgs]) =>
      `  • ${path}:\n${msgs.map(m => `      – ${m}`).join('\n')}`
    )
    .join('\n')

  // Targeted rules — only for fields that actually failed
  const failedPaths = new Set(issues.map(i => i.path[0]?.toString()))
  const rules: string[] = []

  if (failedPaths.has('healthScore'))
    rules.push('- healthScore: copy the exact pre-calculated integer — do not change it')
  if (failedPaths.has('starBreakdown'))
    rules.push('- starBreakdown: must be integers matching the locked star counts exactly, summing to totalSampled')
  if (failedPaths.has('topActions'))
    rules.push('- topActions: exactly 3 items required')
  if (failedPaths.has('strengths'))
    rules.push('- strengths: ≥2 items; businessImpact and marketingAngle must each be ≥40 characters')
  if (failedPaths.has('complaints'))
    rules.push('- complaints: 1–3 fixes per complaint; CRITICAL severity required when healthScore <60')
  if (failedPaths.has('marketingCopy'))
    rules.push('- marketingCopy: exactly 5 items, each verbatim from a review')
  if (failedPaths.has('reviewTemplates'))
    rules.push('- reviewTemplates: exactly 2 items')
  if (failedPaths.has('freeSummary') || failedPaths.has('keyInsight'))
    rules.push('- freeSummary and keyInsight are required at root level — do not omit them')

  const rulesBlock = rules.length > 0
    ? `\nTARGETED RULES FOR FAILED FIELDS:\n${rules.join('\n')}`
    : ''

  return `\
Correction attempt ${attemptNumber}/3. Fix ONLY the listed errors.

VALIDATION ERRORS (${issues.length} total):
${errorBlock}
${rulesBlock}

INSTRUCTIONS:
- Return ONLY the corrected JSON object
- No markdown fences, no explanation, no preamble
- Do not touch any field that is already valid
- Do not re-generate content — only fix what is listed above

BROKEN JSON:
${brokenJson}`
}

// ─────────────────────────────────────────────────────────────
// Convenience: format ZodIssue[] as plain strings (for logging)
// ─────────────────────────────────────────────────────────────

export function formatValidationErrors(issues: ZodIssue[]): string[] {
  return issues.map(issue => {
    const path = issue.path.join('.')
    return path ? `${path}: ${issue.message}` : issue.message
  })
}

// Re-export so callers can import ReportContext from here
export type { ReportContext } from './health-score'