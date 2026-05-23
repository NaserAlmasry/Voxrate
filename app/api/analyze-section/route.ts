// ============================================================
// app/api/analyze-section/route.ts
//
// Progressive section loader — called by the report page after
// the initial complaints section is ready. Each call loads one
// section while the user reads the previous one.
//
// Sections in order:
//   strengths  → Call 2: strengths + improvements
//   seo        → Call 3: SEO + marketing copy + templates
//   summary    → Call 4: quick win + top actions + summary (final)
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { callMistralLatest } from '@/app/lib/mistral-fallback'
import { createClient } from '@/app/lib/supabase/server'
import { Redis } from '@upstash/redis'

const redis = (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
  ? new Redis({ url: process.env.UPSTASH_REDIS_REST_URL!, token: process.env.UPSTASH_REDIS_REST_TOKEN! })
  : null
import { applyHardOverrides } from '@/app/lib/health-score'
import { checkRateLimit } from '@/app/lib/rate-limit'
import { checkCsrf } from '@/app/lib/csrf'
import { extractJson } from '@/app/lib/extract-json'
import {
  SECTION_SYSTEM_PROMPT as SYSTEM_PROMPT,
  buildStrengthsPrompt,
  buildSeoPrompt,
  buildMarketingCopyFixPrompt,
  buildSummaryPromptA,
  buildSummaryPromptB,
} from '@/app/lib/analysis-prompts'

export const maxDuration = 300

export async function POST(request: NextRequest) {
  const csrfError = checkCsrf(request)
  if (csrfError) return csrfError

  try {
    const body    = await request.json()
    const reportId = body?.reportId
    const section  = body?.section as 'strengths' | 'seo' | 'summary'

    if (!reportId || !section) {
      return NextResponse.json({ error: 'reportId and section required' }, { status: 400 })
    }
    if (!['strengths', 'seo', 'summary'].includes(section)) {
      return NextResponse.json({ error: 'Invalid section' }, { status: 400 })
    }

    // Validate UUID format to prevent unexpected DB behavior
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!UUID_REGEX.test(reportId)) {
      return NextResponse.json({ error: 'Invalid report ID' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Fetch user data first so admin status is known before rate limiting
    const { data: userData } = await supabase.from('users').select('is_admin, plan').eq('id', user.id).single()
    const isAdminUser = userData?.is_admin === true
    const userPlan = userData?.plan || 'free'

    // Free plan users cannot load progressive sections — their reports are always 'completed'
    if (!isAdminUser && userPlan === 'free') {
      return NextResponse.json({ error: 'Upgrade required to view this section' }, { status: 403 })
    }

    // Rate limit — admins bypass; section namespace is separate from /api/analyze
    if (!isAdminUser) {
      const limit = await checkRateLimit(`section:${user.id}`, 'user')
      if (!limit.allowed) {
        return NextResponse.json({ error: 'Too many requests. Please wait a moment.' }, { status: 429 })
      }
    }

    // Load the report — verify ownership
    const { data: report, error: reportError } = await supabase
      .from('reports')
      .select('id, user_id, status, full_report, product_name')
      .eq('id', reportId)
      .single()

    if (reportError || !report) {
      console.error(`[AnalyzeSection] 404 userId=${user.id} plan=${userPlan} reportId=${reportId} dbCode=${reportError?.code} dbMsg=${reportError?.message}`)
      return NextResponse.json({ error: 'Report not found' }, { status: 404 })
    }
    if (report.user_id !== user.id && !isAdminUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }
    if (report.status === 'completed') {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { _cache: _stripped, ...publicReport } = report.full_report || {}
      return NextResponse.json({ section, data: publicReport, status: 'completed' })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fullReport: any = report.full_report || {}
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cache: any = fullReport._cache || {}
    const sectionsReady: string[] = fullReport._sectionsReady || ['complaints']

    // Skip if this section is already done
    if (sectionsReady.includes(section)) {
      return NextResponse.json({ section, data: fullReport, alreadyDone: true })
    }

    // Acquire mutex — prevents duplicate LLM calls from concurrent section requests
    let mutexAcquired = false
    const mutexKey = `section-lock:${reportId}:${section}`
    if (redis) {
      const acquired = await redis.set(mutexKey, '1', { nx: true, ex: 120 })
      mutexAcquired = acquired === 'OK'
      if (!mutexAcquired) {
        return NextResponse.json({ error: 'Section already being processed. Please wait a moment and refresh.' }, { status: 409 })
      }
    }

    const {
      contextBlock    = '',
      posReviewText   = '',
      fiveStarText    = '',
      reviewText      = '',
      seoScore        = 0,
      seoReasoning    = '',
      seoTopPhrases   = [] as string[],
      negPct          = 0,
      topComplaintTitle = 'quality issues',
    } = cache

    // Cache was wiped (summary ran before this section) — cannot produce meaningful output
    if (!contextBlock) {
      console.error(`[Section:${section}] Cache missing for report ${reportId} — section requested out of order or after summary completed`)
      return NextResponse.json({ error: 'Section data unavailable. Please re-run the analysis.' }, { status: 409 })
    }

    const updatedReport = { ...fullReport }
    const newSectionsReady = [...sectionsReady]

    // ── Call 2: STRENGTHS + IMPROVEMENTS ────────────────────
    if (section === 'strengths') {
      console.log(`[Section:strengths] Starting for report ${reportId}`)
      const raw = await callMistralLatest([
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: buildStrengthsPrompt({ contextBlock, posReviewText }),
        },
      ], 4000)

      try {
        const parsed: any = extractJson(raw)
        updatedReport.strengths    = Array.isArray(parsed.strengths)    ? parsed.strengths    : []
        updatedReport.improvements = Array.isArray(parsed.improvements) ? parsed.improvements : []

        if (!updatedReport.improvements || updatedReport.improvements.length === 0) {
          const topStrength = updatedReport.strengths?.[0]?.title || 'product quality'
          updatedReport.improvements = [{
            title: 'Amplify top strength in listing copy',
            description: `Your ${topStrength.toLowerCase()} is resonating with buyers — move it to the first line of your listing description and add a backend keyword matching how buyers describe it in 5-star reviews.`,
            impact: 'Better alignment between search intent and listing headline.',
          }]
        }

        newSectionsReady.push('strengths')
        console.log(`[Section:strengths] Done — ${updatedReport.strengths.length} strengths, ${updatedReport.improvements.length} improvements`)
      } catch (e) {
        console.error('[Section:strengths] Parse failed:', String(e).slice(0, 200))
        newSectionsReady.push('strengths')
      }
    }

    // ── Call 3: SEO + MARKETING COPY ────────────────────────
    if (section === 'seo') {
      console.log(`[Section:seo] Starting for report ${reportId}`)
      const raw = await callMistralLatest([
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: buildSeoPrompt({
            contextBlock,
            seoReasoning,
            seoTopPhrases: seoTopPhrases as string[],
            fiveStarText,
            seoScore,
          }),
        },
      ], 2500)

      try {
        const parsed: any = extractJson(raw)
        updatedReport.seo             = parsed.seo             || null
        updatedReport.marketingCopy   = Array.isArray(parsed.marketingCopy)   ? parsed.marketingCopy   : []
        updatedReport.reviewTemplates = Array.isArray(parsed.reviewTemplates) ? parsed.reviewTemplates : []
        updatedReport.careGuide       = parsed.careGuide       || null

        // Restore SEO keywords if model replaced them with fragments
        if (updatedReport.seo && (seoTopPhrases as string[]).length >= 3) {
          const kws: string[] = updatedReport.seo.magicKeywords || []
          const hasFragments = kws.some((k: string) => k.split(' ').length === 1 || k.startsWith('the ') || k.startsWith('this '))
          if (hasFragments || kws.length < 3) {
            updatedReport.seo.magicKeywords = (seoTopPhrases as string[]).slice(0, 5)
          }
        }

        // Tag each keyword with whether it already appears in the product title
        if (updatedReport.seo) {
          const titleLower = (report.product_name || '').toLowerCase()
          updatedReport.seo.keywordFlags = (updatedReport.seo.magicKeywords as string[]).map((kw: string) => ({
            phrase:  kw,
            inTitle: titleLower.includes(kw.toLowerCase()),
          }))
        }

        // Fallback marketing copy from raw review text
        if (!updatedReport.marketingCopy || updatedReport.marketingCopy.length < 3) {
          const lines = reviewText.split('\n').filter((l: string) => l.startsWith('[5★]')).slice(0, 5)
          updatedReport.marketingCopy = lines.map((l: string) => l.replace(/^\[5★\] /, '').slice(0, 200))
        }

        // Semantic check on marketingCopy
        try {
          const violations = (updatedReport.marketingCopy as string[]).filter(
            (item: string) => !reviewText.includes(item.slice(0, 30))
          )
          if (violations.length > 2) {
            console.warn('[Section:seo] marketingCopy likely paraphrased — running correction...')
            const fixRaw = await callMistralLatest([
              { role: 'system', content: SYSTEM_PROMPT },
              { role: 'user', content: buildMarketingCopyFixPrompt(reviewText) },
            ], 600)
            const fixParsed: any = extractJson(fixRaw)
            if (Array.isArray(fixParsed?.marketingCopy) && fixParsed.marketingCopy.length >= 3) {
              updatedReport.marketingCopy = fixParsed.marketingCopy
            }
          }
        } catch {}

        newSectionsReady.push('seo')
        console.log(`[Section:seo] Done — seo:${!!updatedReport.seo} marketing:${updatedReport.marketingCopy.length}`)
      } catch (e) {
        console.error('[Section:seo] Parse failed:', String(e).slice(0, 200))
        // Mark seo ready even on parse failure so the client doesn't spin forever
        newSectionsReady.push('seo')
      }
    }

    // ── Call 4: SUMMARY + QUICK WIN (final — marks report completed) ──
    if (section === 'summary') {
      console.log(`[Section:summary] Starting for report ${reportId}`)
      const topStrengthTitle = updatedReport.strengths?.[0]?.title || fullReport.strengths?.[0]?.title || 'product quality'
      const hs = updatedReport.healthScore || fullReport.healthScore || 0

      // Set fallbacks before any LLM calls so parse failures still leave valid data
      updatedReport.freeSummary = `Your health score of ${hs}/100 is driven primarily by ${topComplaintTitle.toLowerCase()}, reported in ${negPct}% of reviews.`
      updatedReport.keyInsight  = ''
      updatedReport.summary     = `Health score ${hs}/100 — biggest threat: ${topComplaintTitle.toLowerCase()}.`
      updatedReport.quickWin    = null
      updatedReport.topActions  = []

      // Call A: freeSummary, keyInsight, summary, quickWin (flat structure — more reliable parse)
      try {
        const rawA = await callMistralLatest([
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: buildSummaryPromptA({
              contextBlock,
              topComplaintTitle,
              topStrengthTitle,
              healthScore: hs,
              negPct,
            }),
          },
        ], 900)

        console.log('[Section:summary] Call A raw (first 300):', rawA.slice(0, 300))
        const parsedA: any = extractJson(rawA)
        updatedReport.freeSummary = parsedA.freeSummary || updatedReport.freeSummary
        updatedReport.keyInsight  = parsedA.keyInsight  || ''
        updatedReport.summary     = parsedA.summary     || updatedReport.summary
        updatedReport.quickWin    = parsedA.quickWin    || null
        console.log(`[Section:summary] Call A done`)
      } catch (e) {
        console.error('[Section:summary] Call A parse failed:', String(e).slice(0, 200))
      }

      // Call B: topActions (focused prompt — isolated from Call A to prevent truncation)
      try {
        const rawB = await callMistralLatest([
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: buildSummaryPromptB({
              contextBlock,
              topComplaintTitle,
              topStrengthTitle,
              healthScore: hs,
              negPct,
              complaints: (updatedReport.complaints || fullReport.complaints || []).slice(0, 3),
            }),
          },
        ], 2500)

        const parsedB: any = extractJson(rawB)
        if (Array.isArray(parsedB.topActions) && parsedB.topActions.length > 0) {
          updatedReport.topActions = parsedB.topActions.filter(
            (a: any) => a.action && a.action.trim().length > 0
          )
        }
        console.log(`[Section:summary] Call B done — ${updatedReport.topActions.length} topActions`)
      } catch (e) {
        console.error('[Section:summary] Call B parse failed:', String(e).slice(0, 200))
      }

      newSectionsReady.push('summary')
      console.log(`[Section:summary] Done`)
    }

    // Strip cache when summary section is processed (whether parsed or fallback)
    if (section === 'summary') {
      delete updatedReport._cache
    }

    updatedReport._sectionsReady = newSectionsReady

    // Determine new status
    const allDone = ['complaints', 'strengths', 'seo', 'summary'].every(s => newSectionsReady.includes(s))
    const newStatus = allDone ? 'completed' : 'partial'

    // Apply hard overrides only on final merge
    let finalReport = updatedReport
    if (allDone) {
      try {
        // Rebuild ctx-like object from stored health data for override checks
        const { data: patched } = applyHardOverrides(updatedReport, {
          healthScore:      updatedReport.healthScore,
          starCounts:       { 1: updatedReport.starBreakdown?.['1'] || 0, 2: updatedReport.starBreakdown?.['2'] || 0, 3: updatedReport.starBreakdown?.['3'] || 0, 4: updatedReport.starBreakdown?.['4'] || 0, 5: updatedReport.starBreakdown?.['5'] || 0 },
          totalReviewCount: Object.values(updatedReport.starBreakdown || {}).reduce((a: number, b) => a + (b as number), 0),
          weightedRaw:      0,
          penaltyCount:     0,
        } as any)
        finalReport = patched as any
        finalReport._sectionsReady = newSectionsReady
      } catch (e) {
        console.warn('[Section] applyHardOverrides failed:', e)
      }
    }

    // Soft schema validation on final report — log issues but don't block
    if (allDone) {
      try {
        const { validateReport } = await import('@/app/lib/report-schema')
        const healthScore = finalReport.healthScore ?? 0
        const ctx = { tier: finalReport._isLimited ? 'free' : 'pro', healthScore, starCounts: finalReport.starBreakdown ?? {}, totalReviewCount: 0, weightedRaw: 0, penaltyCount: 0 } as any
        const validation = validateReport(finalReport, ctx)
        if (!validation.success) {
          console.warn(`[Section] Schema issues in final report ${reportId}:`, (validation as any).errorStrings?.slice(0, 5))
        }
      } catch (e) {
        console.warn('[Section] Schema validation threw:', e)
      }
    }

    // Save back to DB
    const updatePayload: any = {
      full_report: finalReport,
      status:      newStatus,
    }
    if (section === 'strengths' && finalReport.strengths?.[0]?.title) {
      updatePayload.top_strength = finalReport.strengths[0].title
    }
    if (section === 'strengths' && finalReport.improvements?.[0]?.title) {
      updatePayload.top_improvement = finalReport.improvements[0].title
    }

    await supabase.from('reports').update(updatePayload).eq('id', reportId)

    if (redis && mutexAcquired) {
      await redis.del(mutexKey).catch(() => {})
    }

    console.log(`[Section:${section}] Saved. Status: ${newStatus}. Sections ready: ${newSectionsReady.join(', ')}`)

    // Strip internal cache from the response — raw review text and prompt
    // data must never be sent to the client browser.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { _cache: _strippedCache, ...publicReport } = finalReport

    return NextResponse.json({
      section,
      status:        newStatus,
      sectionsReady: newSectionsReady,
      data:          publicReport,
    })

  } catch (error: any) {
    console.error('[AnalyzeSection] Error:', error instanceof Error ? error.message : String(error))
    return NextResponse.json({ error: 'Section analysis failed. Please try again.' }, { status: 500 })
  }
}
